var express = require("express");
const pool = require("../config/dbconfig");
const { alertAndGo } = require("../lib/respond");
var router = express.Router();

var multer = require('multer');
var _storage = multer.diskStorage({
    destination: function (req, file, cb){
      cb(null, 'uploads/')
    },
    filename: function (req, file, cb){
      cb(null, file.originalname)
    }
  })
  var upload = multer({storage: _storage})


// 개인 회원가입 1
router.post("/sign1", function (req, res) {
  var body = req.body;
  var user_id = body.id;
  var user_pwd = body.pwd;
  var user_name = body.name;
  var user_tel = body.tel;
  var sql = "insert into user(ID, PWD, NAME, TEL) values (?, ?, ?, ?)";
  pool.getConnection((err, conn) => {
      if (err) {
          console.log(err);
          return alertAndGo(res, "잠시 후 다시 시도해 주세요. (서버 연결 오류)");
      }
      conn.query(sql, [user_id, user_pwd, user_name, user_tel],
        function(err, result){
            conn.release();
            if(err){
                console.log(err);
                return alertAndGo(res, "회원가입에 문제가 있습니다..");
            }
            // 회원가입 중에는 아직 로그인 상태가 아니라서, 3단계(카테고리 등록)에서
            // 누구의 가입인지 알 수 있도록 방금 만든 아이디를 세션에 기억해 둔다
            req.session.signupUserId = user_id;
            res.redirect("/sign_second/" + encodeURIComponent(user_id));
        })
  })
});

// 개인 회원가입 2
router.post("/sign2", upload.single('userfile'), function(req, res){
    var user_id = req.body.user_id;
    var user_email = req.body.email;
    // 프로필 이미지 없이 넘어오면 req.file 이 없어 서버가 꺼졌다 → 안내하고 돌려보낸다
    if (!req.file) {
        return alertAndGo(res, "프로필 이미지를 선택해 주세요.");
    }
    let date = new Date();
    let year = date.getFullYear();
    var userfile = req.file.filename;
    var user_age = year - req.body.age + 1;
    var sql = "update user set IMG=?, EMAIL=?, AGE=? where ID=?"
    pool.getConnection((err, conn) => {
        if (err) {
            console.log(err);
            return alertAndGo(res, "잠시 후 다시 시도해 주세요. (서버 연결 오류)");
        }
        conn.query(sql , [userfile, user_email, user_age, user_id], function(err, row){
            conn.release();
            if (err){
                console.log(sql);
                console.log(err);
                // 예전에는 여기서 응답을 보내지 않아 페이지가 끝없이 기다렸다
                return alertAndGo(res, "추가 정보를 저장하지 못했습니다. 다시 시도해 주세요.");
            }
            res.redirect("/sign_choice_category/" + encodeURIComponent(user_id));
        })
    })
})

// 로그인
router.post('/login_user', function(req, res){
    var sess = req.session; // 세션값 사용
    var body = req.body;
    pool.getConnection((err, conn) => {
      if (err) throw err;
      var sql = "SELECT * FROM user where ID=? and PWD=?";
      conn.query(sql, [body.id, body.pwd], (err, row) => {
        if (err) {
          console.log("로그인 에러")
          console.log(err);
        }
        else {
          if(row[0] == null){
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8;" });
            res.write("<script> alert('아이디와 비밀번호가 일치하지 않습니다..'); history.back(); </script>");
          }
          else {
            sess.user = row[0];
            res.redirect('/main');
            conn.release();
          }
        }
      })
    })
})

// 회원 정보 수정
router.post("/user_info_change", function(req, res){
    var sess = req.session; // 세션값 사용
    console.log("ㅎㅇㅎㅇ");
    var body = req.body;
    pool.getConnection((err, conn) => {
      if (err) throw err;
      var sql = "update user set PWD=?, EMAIL=?, TEL=? where user.ID=?";
      conn.query(sql, [body.pwd, body.email, body.tel, sess.user.ID], (err, row) => {
        if (err) {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8;" });
          res.write("<script> alert('정보를 변경할 수 없습니다.'); history.back(); </script>");
          console.log(err);
        }
        else {
          if(row){
            res.redirect('/logout');
            conn.release();
          }
        }
      })
    })
})

// 회원 카드 등록
router.post("/user_register_card", function(req, res){
    var sess = req.session; // 세션값 사용
    var body = req.body;
    var card_number = body.c1 + '-' + body.c2 + '-' + body.c3 + '-' + body.c4;
    console.log(card_number);
    var card_date = body.d1 + '-' + body.d2
    console.log(card_date);
    pool.getConnection((err, conn) => {
      if (err) throw err;
      var sql = "insert into card(NUMBER, USER_ID, DATE, CVC, PWD) values (?, ?, ?, ?, ?)";
      conn.query(sql, [card_number, sess.user.ID, card_date, body.cvc, body.pwd], (err, row) => {
        if (err) {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8;" });
          res.write("<script> alert('카드를 등록할 수 없습니다.'); history.back(); </script>");
          console.log(err);
        }
        else {
          if(row){
            res.redirect('/user_card');
            conn.release();
          }
        }
      })
    })
})
module.exports = router;
