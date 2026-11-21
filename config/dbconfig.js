const mysql = require("mysql");
const fs = require("fs");
const path = require("path");

// PC마다 다른 DB 접속 정보는 git에 올리지 않는 .local/dbconfig.json 에 둔다.
// 우선순위: 환경변수(DB_HOST 등) → .local/dbconfig.json → 기본값
const localConfigPath = path.join(__dirname, "..", ".local", "dbconfig.json");
let localConfig = {};
try {
  localConfig = JSON.parse(fs.readFileSync(localConfigPath, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

function pick(envName, localKey, defaultValue) {
  if (process.env[envName] !== undefined) return process.env[envName];
  if (localConfig[localKey] !== undefined) return localConfig[localKey];
  return defaultValue;
}

const pool = mysql.createPool({
  host: pick("DB_HOST", "host", "localhost"),
  port: Number(pick("DB_PORT", "port", 3306)),
  user: pick("DB_USER", "user", "root"),
  password: pick("DB_PASSWORD", "password", "0000"),
  database: pick("DB_NAME", "database", "db_design_2020"),
  charset: "utf8mb4",
});

// 개발 중 DB에 연결할 수 없으면 샘플 데이터로 화면을 보여준다 (production에서는 그대로)
module.exports = require("./devFallback").wrapPool(pool);
