/*
 * 알림창을 띄운 뒤 이동하는 응답 (기존 코드의 res.write("<script>alert(...)") 패턴을 한곳에)
 *
 * - location 을 주면 그 주소로, 없으면 이전 페이지로 돌아간다(history.back)
 * - 기존 코드는 res.write 만 하고 응답을 끝내지 않아 연결이 열린 채 남았는데, 여기서는 res.end 로 끝낸다
 * - 문구와 주소는 JSON.stringify 로 넣어 따옴표가 섞여도 스크립트가 깨지지 않는다
 */
"use strict";

function alertAndGo(res, message, location) {
  var go = location ? "location.href = " + JSON.stringify(location) + ";" : "history.back();";
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8;" });
  res.end("<script>alert(" + JSON.stringify(message) + "); " + go + "</script>");
}

module.exports = { alertAndGo: alertAndGo };
