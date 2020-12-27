var express = require("express");
var router = express.Router();
const pool = require("../config/dbconfig");

var multer = require("multer");
const { query } = require("express");
const { end } = require("../config/dbconfig");
// 전시회 카테고리 등록
var _storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "category_img/");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
// 전시회 대표 이미지 등록
var _storage_exhibition_title_img = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "public/images/exhibition_title_images/");
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname);
    },
});

// 전시 작품 이미지 저장
var _storage_work_imgs = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "public/images/work_imgs/");
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname);
    },
});

var upload_category = multer({ storage: _storage });
var exhibition_title_img = multer({ storage: _storage_exhibition_title_img });
var work_imgs = multer({ storage: _storage_work_imgs });

Date.prototype.format = function (f) {
  if (!this.valueOf()) return " ";
  var weekKorName = [
    "일요일",
    "월요일",
    "화요일",
    "수요일",
    "목요일",
    "금요일",
    "토요일",
  ];
  var weekKorShortName = ["일", "월", "화", "수", "목", "금", "토"];
  var weekEngName = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  var weekEngShortName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var d = this;
  return f.replace(/(yyyy|yy|MM|dd|KS|KL|ES|EL|HH|hh|mm|ss|a\/p)/gi, function (
    $1
  ) {
    switch ($1) {
      case "yyyy":
        return d.getFullYear(); // 년 (4자리)
      case "yy":
        return (d.getFullYear() % 1000).zf(2); // 년 (2자리)
      case "MM":
        return (d.getMonth() + 1).zf(2); // 월 (2자리)
      case "dd":
        return d.getDate().zf(2); // 일 (2자리)
      case "KS":
        return weekKorShortName[d.getDay()]; // 요일 (짧은 한글)
      case "KL":
        return weekKorName[d.getDay()]; // 요일 (긴 한글)
      case "ES":
        return weekEngShortName[d.getDay()]; // 요일 (짧은 영어)
      case "EL":
        return weekEngName[d.getDay()]; // 요일 (긴 영어)
      case "HH":
        return d.getHours().zf(2); // 시간 (24시간 기준, 2자리)
      case "hh":
        return ((h = d.getHours() % 12) ? h : 12).zf(2); // 시간 (12시간 기준, 2자리)
      case "mm":
        return d.getMinutes().zf(2); // 분 (2자리)
      case "ss":
        return d.getSeconds().zf(2); // 초 (2자리)
      case "a/p":
        return d.getHours() < 12 ? "오전" : "오후"; // 오전/오후 구분
      default:
        return $1;
    }
  });
};
String.prototype.string = function (len) {
  var s = "",
    i = 0;
  while (i++ < len) {
    s += this;
  }
  return s;
};

String.prototype.zf = function (len) {
  return "0".string(len - this.length) + this;
};

Number.prototype.zf = function (len) {
  return this.toString().zf(len);
};

// 카테고리 이미지 등록
router.post("/category", upload_category.single('userfile'), function(req, res){
    var body = req.body;
    var userfile = req.file.filename;
    var sql = "insert into category(NAME, IMG, DESCRIPTION) values (?, ?, ?)";
    pool.getConnection((err, conn) => {
        conn.query(sql, [body.name, userfile, req.body.description], function(err, row){
            console.log("ㅎㅇ");
            if(err){
                console.log(sql);
                console.log(err);
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8;" });
                res.write("<script> alert('카테고리 등록에 문제가 있습니다..'); history.back(); </script>");
                conn.release();
                return;
            }
            if (row){
                res.redirect("/mypage");
                conn.release();
                return;
            } else {
                return;
            }
        })
    })
})

// 전시회 등록
router.post("/application_for_exhibition", exhibition_title_img.single('userfile'), function(req, res){
    var sess = req.session;
    var body = req.body;
    // 데드라인
    var deadline = new Date(body.start_date);
    deadline = deadline.setDate(deadline.getDay() - 30);
    deadline = new Date(deadline);
    // 현재 시간
    var now_date = new Date();
    // 마감 시간
    var end_time = new Date(body.start_date);
    end_time = end_time.setDate(end_time.getDay() + 30);
    end_time = new Date(end_time);
    var sql = "insert into exhibition(USER_ID, CATEGORY, DETAIL_CATEGORY, TITLE, IMG,EXPLAIN_TEXT, REGISTER_TIME, DEADLINE, START_TIME, END_TIME, BOOTH_COUNT, PRODUCTION_COST) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    pool.getConnection((err, conn) => {
        conn.query(sql, [sess.user.ID, body.category, body.category_detail, body.title, req.file.originalname, body.explain_text, now_date, deadline ,body.start_date, end_time, body.booth_count, body.cost], function(err, row){
            if(err){
                console.log(sql);
                console.log(err);
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8;" });
                res.write("<script> alert('전시회 등록에 문제가 있습니다..'); history.back(); </script>");
                conn.release();
                return;
            }
            if (row){
                res.redirect("/application_for_exhibition_second/"+body.title);
                conn.release();
                return;
            } else {
                return;
            }
        })
    })
})

// 전시회 결제 마지막
router.post('/exhibition_registration_last', function(req, res){
    // replaceAll
    function replaceAll(str, searchStr, replaceStr) {
        return str.split(searchStr).join(replaceStr);
      }
    var sess = req.session;
    var body = req.body;
    console.log("ㅎㅇ");
    var account = replaceAll(body.account_price, ",",""); 
    account = parseInt(account);
    var sql1 = "select * from card where USER_ID = ?";
    var sql2 = "select * from exhibition where NUMBER = ?";
    var sql3 = "update exhibition set ADDITIONAL_PAYMENT=?, REGISTER_COST=? where NUMBER=?";
    var sql4 = "insert into exhibition_registration_payment (EXHIBITION_NUMBER, USER_ID, AMOUNT, TIME, REFUND) values (?, ?, ?, now(), 'N')"
    pool.getConnection((err, conn) => {
        conn.query(sql1, [sess.user.ID], function(err, row){
            if(err){
                console.log(err);
                return;
            }
            if(body.cvc == row[0].CVC && body.pwd == row[0].PWD){
                conn.query(sql2, [body.exhb_number], function(err, row2){
                    if(err){
                        console.log(sql2)
                        console.log(err);
                    }
                    if(body.over_pay_on == '추가금 지불됨'){
                        conn.query(sql3, ["Y", account ,row2[0].NUMBER], function(err, row3){
                            if(err){
                                console.log(sql3)
                                console.log(err);
                            }
                            conn.query(sql4, [row2[0].NUMBER, sess.user.ID, account], function(err, row4){
                                if(err){
                                    console.log(sql4)
                                    console.log(err);
                                }
                                if(row4){
                                    res.redirect("/main");
                                    conn.release();
                                }
                            })
                        })
                    }
                    else {
                        conn.query(sql3, ["N", account ,row2[0].NUMBER], function(err, row3){
                            if(err){
                                console.log(sql3)
                                console.log(err);
                            }
                            conn.query(sql4, [row2[0].NUMBER, sess.user.ID, account], function(err, row4){
                                if(err){
                                    console.log(sql4)
                                    console.log(err);
                                }
                                if(row4){
                                    res.redirect("/main");
                                    conn.release();
                                }
                            })
                        })
                    }
                })
            }
            else{
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8;" });
                res.write("<script> alert('CVC 또는 패스워드가 일치하지 않습니다..'); history.back(); </script>");
                conn.release();
            }
        })
    })
})

// 전시회 거절
router.post("/no_reason", function(req, res){
    var body = req.body;
    var number = body.number;
    var now = new Date();
    var sql = "update exhibition set APPROVAL_WHETHER=?,APPROVAL_REJECT_TIME=?, REJECT_REASON=? where NUMBER=?";
    pool.getConnection((err, conn) => {
        conn.query(sql, ['N',now, body.reason, number], function(err, row){
            if(err){
                console.log(sql);
                console.log(err);
            }
            if(row){
                res.redirect("/exhibition_approval")
                conn.release();
            }
        })
    })
})

// 공지사항 작성
router.post("/public_upload", function(req, res){
    var body = req.body;
    var now = new Date();
    var sql = "insert into public (USER_ID, CREATE_TIME, TITLE, CONTENT, HIT) values(?, ?, ?, ?, 0)";
    pool.getConnection((err, conn) => {
        conn.query(sql, [sess.user.ID, now, body.title, body.content], function(err, row){
            if(err){
                console.log(sql);
                console.log(err);
            }
            if(row){
                res.redirect("/public")
                conn.release();
            }
        })
    })
})


// 전시작품 등록
router.post("/exhibition_support_registration", work_imgs.array('userfile'), function(req, res){
    var sess = req.session;
    var body = req.body;
    console.log(req.files[0].filename);
    var sql1 = "insert into work (EXHIBITION_NUMBER, USER_ID, TITLE, REGISTER_TIME, EXPLANATION, BOOTH_NUMBER) values (?, ?, ?, now(), ?, ?)";
    var sql2 = "insert into work_content (WORK_EXHIBITION_NUMBER, WORK_SEQUENCE, FILE_NAME, BOOTH_NUMBER) values (?, ?, ?, ?)"
    pool.getConnection((err, conn) => {
        conn.query(sql1, [body.hidden_number, sess.user.ID, body.title, body.explain_text, body.booth_number, body.booth_number], function(err, row){
            if(err){
                console.log(sql);
                console.log(err);
                conn.release();
            }
            if(req.files[0] != undefined){
                conn.query(sql2, [body.hidden_number, 1, req.files[0].originalname, body.booth_number], function(err, row2){
                })
            }
            if(req.files[1] != undefined){
                conn.query(sql2, [body.hidden_number, 2, req.files[1].originalname, body.booth_number], function(err, row3){
                })
            }
            if(req.files[2] != undefined){
                conn.query(sql2, [body.hidden_number, 3, req.files[2].originalname, body.booth_number], function(err, row4){
                })
            }
            if(row){
                res.redirect("/supportable_exhibition")
                conn.release();
            }
        })
    })
})

// 문의 등록
router.post("/upload_inquiry", function(req, res){
    var body = req.body;
    var sess = req.session;
    var now = new Date();
    var sql = "insert into inquiry (USER_ID, REGISTER_TIME, TITLE, CONTENT, CATEGORY) values(?, ?, ?, ?, ?)";
    pool.getConnection((err, conn) => {
        conn.query(sql, [sess.user.ID, now, body.title, body.content, body.category], function(err, row){
            if(err){
                console.log(sql);
                console.log(err);
            }
            if(row){
                res.redirect("/inquiry_list")
                conn.release();
            }
        })
    })
})

// 문의 답변
router.post("/inquiry_answer_admin", function(req, res){
    var body = req.body;
    var sess = req.session;
    var sql = "update inquiry set ADMIN_ID=?, ANSWER_WHETHER='Y', ANSWER=? where NUMBER=?";
    pool.getConnection((err, conn) => {
        console.log("ㅎㅇㅎㅇ");
        conn.query(sql, [sess.user.ID, body.answer, body.number], function(err, row){
            if(err){
                console.log(sql);
                console.log(err);
            }
            console.log("ㅎㅇㅎㅇ");
            if(row){
                res.redirect("/inquiry_answer")
                conn.release();
            }
        })
    })
})

// 카테고리 등록
router.post("/category_register", function(req, res){
    var body = req.body;
    var sess = req.session;
    var sql = "insert into user_category (USER_ID, CATEGORY_NAME) values (?, ?)"
    pool.getConnection((err, conn)=>{
        for(var i = 0; i < 3; i++){
            conn.query(sql, [sess.user.ID ,body.category1[i]], function(err, row){
            })
        }
        res.redirect("/main");
        conn.release();
    })  
})

// 리뷰작성
router.post("/post_review", function(req, res){
    var sess = req.session;
    var body = req.body;
    var now = new Date();
    console.log(now);
    console.log(body);
    var sql = "insert into review (USER_ID, EXHIBITION_NUMBER, CREATE_TIME, SCORE, CONTENT) values(?, ?, ?, ?, ?)";
    pool.getConnection((err, conn) => {
        conn.query(sql, [sess.user.ID, body.number, now, body.rating, body.content], function(err, row){
            if(err){
                console.log(sql);
                console.log(err);
            }
            if(row){
                res.redirect("/main")
                conn.release();
            }
        })
    })
})

// 환불신청
router.post("/post_compensating", function(req, res){
    console.log("ㅎㅇㅎㅇ");
    var sess = req.session;
    var body = req.body;
    var now = new Date();
    console.log(now);
    console.log(body);
    var sql = "insert into compensating (USER_ID, ASK_TIME, COMPENSATING_TYPE, TYPE, CONTENT, ACCOUNT_NUMBER, AMOUNT, APPROVAL_WHETHER) values(?, ?, ?, ?, ?, ?, ?, ?)";
    var sql2 = "update exhibition_payment_record set REFUND_STATUS=?, REFUND_TIME=?,PAYMENT_AMOUNT=? where NUMBER=?";
    if (body.view_status == 'Y'){
        pool.getConnection((err, conn) => {
            conn.query(sql, [sess.user.ID, now, body.account_type, body.type, body.content, body.account_number, body.amount, 'Y'], function(err, row){
                conn.query(sql2, ['Y', now, 0, body.account_number], function(err, row){
                    if(err){
                        console.log(sql);
                        console.log(err);
                    }
                    if(row){
                        res.redirect("/main")
                        conn.release();
                    }
                })
            })
        })
    }
    if (body.view_status == 'N'){
        pool.getConnection((err, conn) => {
            conn.query(sql, [sess.user.ID, now, body.account_type, body.type, body.content, body.account_number, body.amount, 'N'], function(err, row){
                if(err){
                    console.log(sql);
                    console.log(err);
                }
                if(row){
                    res.redirect("/main")
                    conn.release();
                }
            })
        })
    }
})

// 출금
router.post("/settlement_of_holding_amount", function(req, res){
    var sess = req.session;
    var body = req.body;
    var now = new Date();
    var sql = "insert into exhibition_calculate (USER_ID, TIME, AMOUNT, ACCOUNT_NUMBER, BANK) values(?, ?, ?, ?, ?)";
    var sql2 = "update user set HAVE_AMOUNT=? where ID=?"
    pool.getConnection((err, conn) => {
        conn.query(sql, [sess.user.ID, now, body.amount, body.account, body.bank], function(err, row){
            conn.query(sql2, [sess.user.HAVE_AMOUNT + body.amount, sess.user.ID], function(err, row2){
                if(err){
                    console.log(sql);
                    console.log(err);
                }
                if(row){
                    sess.user = row[0];
                    res.redirect("/main")
                    conn.release();
                }
            })
        })
    })
})

module.exports = router;