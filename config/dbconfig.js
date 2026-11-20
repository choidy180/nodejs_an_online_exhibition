const mysql = require("mysql");

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "0000",
  database: "db_design_2020",
});

// 개발 중 DB에 연결할 수 없으면 샘플 데이터로 화면을 보여준다 (production에서는 그대로)
module.exports = require("./devFallback").wrapPool(pool);
