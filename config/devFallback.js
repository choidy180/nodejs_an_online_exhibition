/*
 * 개발용 DB 대체 — DB에 연결할 수 없을 때도 화면은 확인할 수 있게 한다.
 *
 * - NODE_ENV가 production이 아니면, DB 연결에 실패했을 때 진짜 커넥션 대신
 *   샘플 데이터를 돌려주는 가짜 커넥션을 넘긴다. (production에서는 아무것도 바꾸지 않는다)
 * - 읽기(SELECT): exhibition 은 샘플 전시회(검색어가 있으면 걸러서), category 는 샘플 카테고리,
 *   public 은 샘플 공지사항,
 *   전시회 번호로 찾는 review / review_comments 는 샘플 관람평 · 댓글, 나머지는 빈 목록
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
  // 작품을 받고 있는 전시 (SUPPORT 화면 확인용) — 마감 · 시작이 앞으로
  { TITLE: "작은 방의 기록", IMG: "84c62e60-a6a2-4c1e-a066-44d24d7c4bc1.jpg", CATEGORY: "사진", phase: "recruit" },
  { TITLE: "여름의 색", IMG: "b259fe249a50e23759ef8d0ad96db86ddc4f4903.jpg", CATEGORY: "회화", phase: "recruit" },
  // 이미 끝난 전시 (TERMINATION 화면 확인용)
  { TITLE: "지난 계절", IMG: "c416adcb1648aecbf9348e0edcc8c2ffedbdec2c.jpg", CATEGORY: "사진", phase: "ended" },
  { TITLE: "오래된 골목", IMG: "875a3e72-1bea-47de-8edf-e12553456d13.jpg", CATEGORY: "여행", phase: "ended" },
];

// 진행 중(기본) · 모집 중 · 종료 에 맞는 날짜
function sampleTimes(phase, i, j, now) {
  if (phase === "recruit") {
    return {
      REGISTER_TIME: new Date(now - (5 + j) * DAY),
      DEADLINE: new Date(now + (10 + j * 5) * DAY),
      START_TIME: new Date(now + (25 + j * 5) * DAY),
      END_TIME: new Date(now + (60 + j * 5) * DAY),
    };
  }
  if (phase === "ended") {
    return {
      REGISTER_TIME: new Date(now - (120 + j) * DAY),
      DEADLINE: new Date(now - (100 + j) * DAY),
      START_TIME: new Date(now - (90 + j * 10) * DAY),
      END_TIME: new Date(now - (15 + j * 20) * DAY),
    };
  }
  return {
    REGISTER_TIME: new Date(now - (40 + i) * DAY),
    DEADLINE: new Date(now - (20 + i) * DAY),
    START_TIME: new Date(now - (10 + i) * DAY),
    END_TIME: new Date(now + (20 + i * 3) * DAY),
  };
}

// "END_TIME < ?" 처럼 날짜·숫자를 비교하는 조건은 샘플에도 적용한다 (진행 중 · 종료 · 모집 중 구분)
function applyComparisons(rows, text, values) {
  if (!values || !values.length) return rows;
  const toNumber = (v) => (v instanceof Date ? v.getTime() : typeof v === "number" ? v : new Date(v).getTime());
  const conditions = [];
  const re = /(\w+)\s*(<=|>=|<|>)\s*\?/g;
  let m;
  while ((m = re.exec(text))) {
    const index = (text.slice(0, m.index + m[0].length).match(/\?/g) || []).length - 1;
    conditions.push({ key: m[1].toUpperCase(), op: m[2], value: values[index] });
  }
  return rows.filter((row) =>
    conditions.every((c) => {
      if (row[c.key] === undefined || c.value === undefined) return true;
      const a = toNumber(row[c.key]);
      const b = toNumber(c.value);
      if (c.op === "<") return a < b;
      if (c.op === ">") return a > b;
      if (c.op === "<=") return a <= b;
      return a >= b;
    })
  );
}

function sampleExhibitions() {
  const now = Date.now();
  const seen = {};
  return SAMPLE_EXHIBITIONS.map((item, i) => Object.assign({
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
  }, (function () {
    // j: 같은 단계 안에서 몇 번째인지 (날짜를 조금씩 다르게)
    const phase = item.phase || "now";
    seen[phase] = (seen[phase] || 0) + 1;
    return sampleTimes(phase, i, seen[phase] - 1, now);
  })()));
}

// category_img 폴더의 이미지로 만든 샘플 카테고리 (회원가입 3단계 화면 확인용)
const SAMPLE_CATEGORIES = [
  ["미디어아트", "10_Flower Forest Lost, Immersed and Reborn_teamlabBorderless.jpg"],
  ["디자인", "Apple_announce-iphone12pro_10132020_big.jpg.large_2x.jpg"],
  ["일러스트", "KakaoTalk_20200826_023245409_03.png"],
  ["스포츠", "Return_of_Sports.jpg"],
  ["엔터테인먼트", "a307496d21f9bd8f4a926e4308ebdfa35eeb4859.gif"],
  ["사진", "a61fdd1cf51103f34a92f020b804b52b85e25fb3.jpg"],
  ["회화", "art-art-history_main_1440x800.jpg"],
  ["공연", "dffac4d38912dbc75e7ecc10f690459236e44476.gif"],
  ["인물", "iu_full.jpg"],
  ["게임 아트", "l4XorHXMUe8lWc00lQso.jpg"],
].map(([NAME, IMG], i) => ({ NUMBER: i + 1, NAME, IMG }));

// 공지사항 화면 확인용 샘플 (최신 글이 먼저)
function sampleNotices() {
  const now = Date.now();
  return [
    { TITLE: "온라인 전시관 화면이 새로워졌습니다", HIT: 128, days: 1,
      CONTENT: "메인 화면과 전시회 상세 화면을 새로 다듬었습니다.\n전시를 더 편하게 둘러볼 수 있도록 계속 고쳐 나가겠습니다." },
    { TITLE: "12월 정기 점검 일정 안내", HIT: 86, days: 4,
      CONTENT: "12월 9일(화) 새벽 2시부터 4시까지 서비스 점검이 있습니다.\n점검 중에는 전시 관람과 결제를 이용할 수 없습니다." },
    { TITLE: "관람권 환불 기준이 바뀝니다", HIT: 203, days: 12,
      CONTENT: "관람 시작 전에는 전액, 관람을 시작한 뒤에는 남은 기간만큼 환불됩니다." },
    { TITLE: "작가 지원 프로그램 2기 모집", HIT: 341, days: 25,
      CONTENT: "온라인 전시를 열고 싶은 작가를 모집합니다. 자세한 내용은 SUPPORT 메뉴를 확인해 주세요." },
  ].map((item, i, list) => ({
    NUMBER: list.length - i,
    USER_ID: "IU",
    TITLE: item.TITLE,
    CONTENT: item.CONTENT,
    HIT: item.HIT,
    CREATE_TIME: new Date(now - item.days * DAY),
  }));
}

// 전시회 상세 화면의 관람평 · 댓글 확인용 샘플 (전시회 번호로 찾는 쿼리에만 돌려준다)
function sampleReviews(exhibitionNumber) {
  const now = Date.now();
  return [
    { USER_ID: "sample_kim", SCORE: 5, CONTENT: "작품 사이를 천천히 걷는 느낌이라 좋았어요.\n조명 연출이 특히 인상적이었습니다." },
    { USER_ID: "sample_lee", SCORE: 4, CONTENT: "설명이 조금 더 있었으면 좋겠지만 전체적으로 만족스러운 전시였어요." },
    { USER_ID: "sample_park", SCORE: 3, CONTENT: "사진이 많아서 둘러보는 데 시간이 걸렸어요." },
  ].map((item, i) => ({
    NUMBER: i + 1,
    EXHIBITION_NUMBER: Number(exhibitionNumber) || 1,
    USER_ID: item.USER_ID,
    SCORE: item.SCORE,
    CONTENT: item.CONTENT,
    CREATE_TIME: new Date(now - (i + 1) * 2 * DAY),
  }));
}

function sampleReviewComments(exhibitionNumber) {
  const now = Date.now();
  return [
    { REVIEW_NUMBER: 1, USER_ID: "sample_choi", CONTENT: "저도 조명이 제일 기억에 남아요!" },
    { REVIEW_NUMBER: 1, USER_ID: "sample_kim", CONTENT: "다음 전시도 기대됩니다." },
  ].map((item, i) => ({
    NUMBER: i + 1,
    EXHIBITION_NUMBER: Number(exhibitionNumber) || 1,
    REVIEW_NUMBER: item.REVIEW_NUMBER,
    USER_ID: item.USER_ID,
    CONTENT: item.CONTENT,
    CREATE_TIME: new Date(now - (i + 1) * DAY),
  }));
}

function rowsFor(sql, values) {
  const text = String(sql).trim().toLowerCase();
  if (!text.startsWith("select")) {
    return { affectedRows: 0, insertId: 0, changedRows: 0 };
  }
  if (/\bfrom\s+(\w+\.)?exhibition\b/.test(text)) {
    let rows = sampleExhibitions();
    // "where NUMBER=?" 처럼 한 건을 찾는 쿼리면 그 번호의 샘플을 돌려준다
    if (/where\s+number\s*=\s*\?/.test(text) && values && values.length) {
      const found = rows.filter((row) => String(row.NUMBER) === String(values[0]));
      return found.length ? found : [rows[0]];
    }
    rows = applyComparisons(rows, text, values);
    // 검색 ("TITLE like ?" 등): 제목·분야에 검색어가 들어 있는 샘플만
    if (/\blike\s+\?/.test(text) && values && values.length) {
      const term = String(values[0]).replace(/^%|%$/g, "").replace(/\\(.)/g, "$1").toLowerCase();
      return rows.filter((row) =>
        [row.TITLE, row.CATEGORY, row.DETAIL_CATEGORY].some((v) => String(v || "").toLowerCase().includes(term))
      );
    }
    return rows;
  }
  if (/\bfrom\s+(\w+\.)?public\b/.test(text)) {
    const notices = sampleNotices();
    if (/where\s+number\s*=\s*\?/.test(text) && values && values.length) {
      return notices.filter((row) => String(row.NUMBER) === String(values[0]));
    }
    return notices;
  }
  if (/\bfrom\s+(\w+\.)?category\b/.test(text)) {
    return SAMPLE_CATEGORIES.map((row) => Object.assign({}, row));
  }
  // "select * from review where EXHIBITION_NUMBER=?" 처럼 전시회의 관람평 목록을 찾을 때만.
  // (사용자별로 찾는 쿼리는 빈 목록 그대로 — 이미 관람평을 쓴 것처럼 보이지 않게)
  const byExhibition = /^\s*where\s+exhibition_number\s*=\s*\?\s*;?\s*$/;
  const reviewMatch = text.match(/\bfrom\s+(\w+\.)?(review_comments|review)\b(.*)$/);
  if (reviewMatch && byExhibition.test(reviewMatch[3]) && values && values.length) {
    return reviewMatch[2] === "review" ? sampleReviews(values[0]) : sampleReviewComments(values[0]);
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
