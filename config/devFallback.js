/*
 * 개발용 DB 대체 — DB에 연결할 수 없을 때도 화면은 확인할 수 있게 한다.
 *
 * - NODE_ENV가 production이 아니면, DB 연결에 실패했을 때 진짜 커넥션 대신
 *   샘플 데이터를 돌려주는 가짜 커넥션을 넘긴다. (production에서는 아무것도 바꾸지 않는다)
 * - 읽기(SELECT): exhibition 테이블은 샘플 전시회, 나머지는 빈 목록
 * - 쓰기(INSERT/UPDATE/DELETE): 아무것도 저장하지 않고 성공한 것처럼 돌려준다
 * - 한 번 실패하면 30초 동안은 DB에 다시 붙어 보지 않고 바로 샘플 데이터를 쓴다
 *   (요청마다 연결 대기 시간이 생기지 않게). DB가 살아나면 자동으로 진짜 데이터로 돌아간다.
 * - 끄려면 환경변수 DB_FALLBACK=off
 */
"use strict";

const ENABLED = process.env.NODE_ENV !== "production" && process.env.DB_FALLBACK !== "off";
const RETRY_AFTER_MS = 30 * 1000;
const DAY = 24 * 60 * 60 * 1000;

// public/images/exhibition_title_images 에 있는 이미지로 만든 샘플 전시회
const SAMPLE_EXHIBITIONS = [
  { TITLE: "빛의 정원", IMG: "22cd4bfa0fcd5c2441cbe60bec5f7dd6347e7828.jpg", CATEGORY: "사진" },
  { TITLE: "도시의 밤", IMG: "2e332f7759aab3e8c1237304c328b81e5b60c207.jpg", CATEGORY: "사진" },
  { TITLE: "미국의 도시들", IMG: "679b01876dd44b36a02c0f7ea2be7650f5ad8f09.jpg", CATEGORY: "여행" },
  { TITLE: "MÜNCHEN", IMG: "2624d40fed2c0b1512ec160223dae034bf341156.jpg", CATEGORY: "여행" },
  { TITLE: "색의 온도", IMG: "826e660dfde5cd1b7fa2dd28d67f61d91b292e6b.jpg", CATEGORY: "회화" },
  { TITLE: "기억의 조각", IMG: "a36f81c417464bff9bf2096170fb11f9dab61936.jpg", CATEGORY: "회화" },
];

function sampleExhibitions() {
  const now = Date.now();
  return SAMPLE_EXHIBITIONS.map((item, i) => ({
    NUMBER: i + 1,
    TITLE: item.TITLE,
    IMG: item.IMG,
    USER_ID: "sample",
    CATEGORY: item.CATEGORY,
    DETAIL_CATEGORY: item.CATEGORY,
    CONTENT: "DB에 연결되지 않아 보여 주는 샘플 전시회입니다.",
    EXPLAIN_TEXT: "DB에 연결되지 않아 보여 주는 샘플 전시회입니다.",
    APPROVAL_WHETHER: "Y",
    HIT: 0,
    BOOTH_COUNT: 6,
    VIEWING_AVA_COUNT: 100,
    REGISTER_COST: 100000,
    PRODUCTION_COST: 0,
    REGISTER_TIME: new Date(now - (40 + i) * DAY),
    DEADLINE: new Date(now - (20 + i) * DAY),
    START_TIME: new Date(now - (10 + i) * DAY),
    END_TIME: new Date(now + (20 + i * 3) * DAY),
  }));
}

function rowsFor(sql, values) {
  const text = String(sql).trim().toLowerCase();
  if (!text.startsWith("select")) {
    return { affectedRows: 0, insertId: 0, changedRows: 0 };
  }
  if (/\bfrom\s+(\w+\.)?exhibition\b/.test(text)) {
    const rows = sampleExhibitions();
    // "where NUMBER=?" 처럼 한 건을 찾는 쿼리면 그 번호의 샘플을 돌려준다
    if (/where\s+number\s*=\s*\?/.test(text) && values && values.length) {
      const found = rows.filter((row) => String(row.NUMBER) === String(values[0]));
      return found.length ? found : [rows[0]];
    }
    return rows;
  }
  return [];
}

function createSampleConnection() {
  return {
    query(sql, values, callback) {
      if (typeof values === "function") {
        callback = values;
        values = undefined;
      }
      const result = rowsFor(sql, values);
      setImmediate(() => {
        if (callback) callback(null, result, []);
      });
    },
    release() {},
  };
}

function wrapPool(pool) {
  if (!ENABLED) return pool;

  let downUntil = 0;
  let warned = false;

  return {
    getConnection(callback) {
      if (Date.now() < downUntil) {
        setImmediate(() => callback(null, createSampleConnection()));
        return;
      }
      pool.getConnection((err, conn) => {
        if (!err) {
          warned = false;
          callback(null, conn);
          return;
        }
        downUntil = Date.now() + RETRY_AFTER_MS;
        if (!warned) {
          warned = true;
          console.warn(
            `[dev] DB 연결 실패 (${err.code || err.message}) → 샘플 데이터로 화면을 보여줍니다. ` +
              "저장은 되지 않습니다. 끄려면 DB_FALLBACK=off"
          );
        }
        callback(null, createSampleConnection());
      });
    },
    query: pool.query.bind(pool),
    end: pool.end.bind(pool),
    on: pool.on.bind(pool),
  };
}

module.exports = { wrapPool };
