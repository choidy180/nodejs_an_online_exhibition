var express = require("express");
const app = express();
const { HTTPVersionNotSupported } = require("http-errors");
var router = express.Router();
const pool = require("../config/dbconfig");

function addComma(num) {
    var regexp = /\B(?=(\d{3})+(?!\d))/g;
    return num.toString().replace(regexp, ',');
}

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

// 인트로 페이지 O
router.get("/", function(req, res){
    console.log("인트로페이지");
    res.render('intro.ejs')
})

// 시작 페이지 O
router.get("/start", function(req, res){
    console.log("시작페이지");
    res.render('start.ejs')
})

// 로그인 O
router.get("/login", function(req, res){
    console.log("로그인");
    res.render('user/login.ejs')
})

// 회원가입 1 O 
router.get("/sign_first", function(req, res){
    console.log("회원가입1");
    res.render('user/sign_first.ejs')
})
// 회원가입 2 O
router.get("/sign_second/:first_sign", function(req, res){
    var user_id = req.params.first_sign;
    console.log("회원가입2");
    res.render('user/sign_second.ejs',{
        user_id:user_id
    })
})

// 회원가입 카테고리 선택
router.get("/sign_choice_category/:user_id", function(req, res){
    var sess = req.session;
    console.log("카테고리 선택");
    var sql = "select * from category"
    pool.getConnection((err, conn)=>{
        conn.query(sql, function(err, row){
            res.render('user/sign_choice_category.ejs',{
                sess:sess,
                id: req.params.user_id,
                row,row
            })
            conn.release();
        })
    })
})

//메인페이지 O
router.get("/main", function(req, res){
    var sess = req.session;
    var now = new Date();
    var sql = "select * from exhibition where START_TIME<? AND END_TIME>?"
    pool.getConnection((err, conn) => {
        conn.query(sql, [now, now], function(err, row){
            var start_date = new Array();
                for (var sdc = 0; sdc < row.length; sdc ++){
                start_date[sdc] = row[sdc].START_TIME.format('yyyy-MM-dd');
            }
            var end_date = new Array();
                for (var edc = 0; edc < row.length; edc ++){
                end_date[edc] = row[edc].END_TIME.format('yyyy-MM-dd');
            }
            console.log(row.length);
            res.render('main.ejs',{
                title: "EXHIBITION",
                page: "main/main_page.ejs",
                sess:sess,
                row:row,
                start_date:start_date,
                end_date:end_date
            })
            conn.release();
        })
    })
})

// 로그아웃 O
router.get("/logout", function (req, res) {
  var sess = req.session;
  console.log("로그아웃");
  sess.destroy();
  res.redirect("/main");
});


//유저 마이페이지 메인 O
router.get("/mypage", function(req, res) {
    var sess = req.session;
    var sql = "select * from work where USER_ID=?"
    var sql2 = "select * from card where USER_ID=?"
    var sql3 = "SELECT * FROM work_calculate where USER_ID=?;"
    pool.getConnection((err, conn) => {
        conn.query(sql, [sess.user.ID], function(err, row){
            conn.query(sql2, [sess.user.ID], function(err, row2){
                conn.query(sql3, [sess.user.ID], function(err, row3){
                    var result = 0;
                    for (var i  = 0; i < row3.length; i++){
                        result = result + row3[i].AMOUNT;
                    }
                    result = addComma(result - sess.user.HAVE_AMOUNT);
                    res.render("main.ejs", {
                        title: "마이페이지",
                        page: "user/mypage.ejs",
                        sess:sess,
                        row:row,
                        row2:row2,
                        result:result
                    });
                    conn.release();
                })
            })
        })
    })
})

//유저 마이페이지 결제 O
router.get("/mypage_payment", function(req, res) {
    var sess = req.session;
    res.render("main.ejs", {
        title: "결제",
        page: "user/mypage_payment.ejs",
        sess:sess
    });
})

// 전시회 문의 O
router.get("/inquiry", function(req, res) {
    var sess = req.session;
    res.render("main.ejs", {
        title: "문의",
        page: "user/inquiry.ejs",
        sess:sess
    });
})

// 전시회 결제 문의 O
router.get("/inquiry_payment", function(req, res) {
    var sess = req.session;
    res.render("main.ejs", {
        title: "문의",
        page: "user/inquiry_payment.ejs",
        sess:sess
    });
})

// 전시회 문의 O
router.get("/inquiry_list", function(req, res) {
    var sess = req.session;
    var sql = "select * from inquiry where USER_ID = ?"
    pool.getConnection((err, conn)=>{
        conn.query(sql, [sess.user.ID], function(err, row){
            if(err){
                console.log(sql);
                console.log(err);
            }
            var register_date = new Array();
                for (var rdc = 0; rdc < row.length; rdc ++){
                    register_date[rdc] = row[rdc].REGISTER_TIME.format('MM-dd');
            }
            if(row){
                res.render("main.ejs", {
                    title: "문의 리스트",
                    page: "user/inquiry_list.ejs",
                    sess:sess,
                    row:row,
                    register_date:register_date
                });
                conn.release();
            }
        })
    })
})

// 전시회 문의 답변 O
router.get("/inquiry_answer", function(req, res){
    var sess = req.session;
    var sql = "select * from inquiry where ANSWER_WHETHER='N'"
    pool.getConnection((err, conn)=>{
        conn.query(sql, function(err, row){
            if(err){
                console.log(sql);
                console.log(err);
            }
            var register_date = new Array();
                for (var rdc = 0; rdc < row.length; rdc ++){
                    register_date[rdc] = row[rdc].REGISTER_TIME.format('MM-dd');
            }
            if(row){
                res.render("admin.ejs", {
                    title: "문의",
                    page: "admin/inquiry_answer.ejs",
                    sess:sess,
                    row:row,
                    register_date:register_date
                });
                conn.release();
            }
        })
    })
})

// 전시회 문의 답변 상세 o
router.get("/inquiry_answer_detail/:number", function(req, res){
    var sess = req.session;
    var number = req.params.number;
    var sql = "select * from inquiry where NUMBER=?"
    pool.getConnection((err, conn)=>{
        conn.query(sql, [number], function(err, row){
            if(err){
                console.log(sql);
                console.log(err);
            }
            var register_date = new Array();
                for (var rdc = 0; rdc < row.length; rdc ++){
                    register_date[rdc] = row[rdc].REGISTER_TIME.format('yyyy-MM-dd');
            }
            if(row){
                console.log(row);
                res.render("admin.ejs", {
                    title: "문의",
                    page: "admin/inquiry_answer_detail.ejs",
                    sess:sess,
                    row:row,
                    register_date:register_date
                });
                conn.release();
            }
        })
    })
})

// 답변완료된 전시회 상세 O
router.get("/inquiry_list_yes/:number", function(req, res) {
    var sess = req.session;
    var number = req.params.number;
    var sql = "select * from inquiry where NUMBER = ?"
    pool.getConnection((err, conn)=>{
        conn.query(sql, [number], function(err, row){
            if(err){
                console.log(sql);
                console.log(err);
            }
            var register_date = new Array();
                for (var rdc = 0; rdc < row.length; rdc ++){
                    register_date[rdc] = row[rdc].REGISTER_TIME.format('yyyy-MM-dd HH시mm분');
            }
            if(row){
                res.render("main.ejs", {
                    title: "문의 리스트",
                    page: "user/inquiry_list_yes.ejs",
                    sess:sess,
                    row:row,
                    register_date:register_date
                });
                conn.release();
            }
        })
    })
})
//전시회 카테고리 생성 O
router.get("/category_generation", function(req, res){
    var sess = req.session;
    res.render("main.ejs", {
        title: "카테고리 등록",
        page: 'board/category_generation.ejs',
        sess:sess
    })
})

// 전시회 카테고리 리스트O
router.get("/category_list", function(req, res) {
    var sess = req.session;
    var sql = "select * from category"
    pool.getConnection((err, conn) => {
        conn.query(sql, function(err, row){
            if(err){
                console.log(err);
                console.log(sql);
                return;
            }
            if(row){
                console.log(row);
                res.render("main.ejs", {
                    title: "카테고리 리스트",
                    page: 'board/category_list.ejs',
                    sess:sess,
                    row:row
                })
                conn.release();
            }
        })
    })
})

//전시회 등록 신청 O
router.get("/application_for_exhibition", function(req, res){
    var sess = req.session;
    let date = new Date();
    date.setMonth(date.getMonth() + 6);
    let start_day = date.toLocaleString()
    date = date.format('yyyy-MM-dd a/p hh:mm:ss');
    var sql = "select * from category"
    pool.getConnection((err, conn) => {
        conn.query(sql, function(err, row){
            if(err){
                console.log(err);
                console.log(sql);
                return;
            }
            if(row){
                res.render("main.ejs", {
                    title: "전시회 등록",
                    page: 'board/application_for_exhibition.ejs',
                    sess:sess,
                    row:row,
                    start_day:start_day,
                    date:date
                })
                conn.release();
            }
        })
    })
})
//전시회 등록 신청2 (결제) O
router.get("/application_for_exhibition_second/:title", function(req, res){
    console.log("ㅎㅇ");
    var sess = req.session;
    var title = req.params.title;
    var sql = "select * from exhibition where title=?"
    pool.getConnection((err, conn) => {
        conn.query(sql, [title],function(err, row){
            if(err){
                console.log(err);
                console.log(sql);
                return;
            }
            if(row){
                var register_date = new Date(row[0].REGISTER_TIME);
                register_date = register_date.format('yyyy-MM-dd a/p hh:mm:ss');
                var daealine = new Date(row[0].DEADLINE);
                daealine = daealine.format('yyyy-MM-dd a/p hh:mm:ss');
                var start_time = new Date(row[0].START_TIME);
                start_time = start_time.format('yyyy-MM-dd a/p hh:mm:ss');
                var end_time = new Date(row[0].END_TIME);
                end_time = end_time.format('yyyy-MM-dd a/p hh:mm:ss');
                res.render("main.ejs", {
                    title: "전시회 등록 [결제]",
                    page: 'board/application_for_exhibition_second.ejs',
                    sess:sess,
                    row:row,
                    register_date:register_date,
                    daealine: daealine,
                    start_time:start_time,
                    end_time:end_time
                })
                conn.release();
            }
        })
    })
})

//전시회 등록 신청2 (결제)
router.get("/application_for_exhibition_third/:number", function(req, res){
    console.log("ㅎㅇ");
    var sess = req.session;
    var number = req.params.number;
    var exhibition_number = number.split('=')[0];
    var over_pay = number.split('=')[2];
    console.log(over_pay);
    console.log(exhibition_number);
    var price = number.split('=')[1];
    console.log(price);
    var sql = "select * from card where USER_ID = ?"
    pool.getConnection((err, conn) => {
        conn.query(sql, [sess.user.ID], function(err, row){
            if(err){
                console.log(sql);
                console.log(err);
            }
            if(row){
                res.render("main.ejs", {
                    title: "전시회 등록 [결제]",
                    page: 'board/application_for_exhibition_third.ejs',
                    sess:sess,
                    price:price,
                    exhibition_number:exhibition_number,
                    row:row,
                    over_pay:over_pay
                })
                conn.release();
            }
        })
    })
})
// 전시회 검색 O
router.get("/search_exhibitions", function(req, res){
    var sess = req.session;
    res.render('main.ejs', {
        title: "전시회 검색 페이지",
        page: "board/search_exhibitions.ejs",
        sess:sess
    })
})

// 전시회 상세 페이지 O
router.get("/exhibition_detail/:number", function(req, res){
    console.log("전시회 상세 페이지");
    var sess = req.session;
    var number= req.params.number;
    var now = new Date();
    var sql = "select * from exhibition where NUMBER=?"
    var sql2 = "select * from work_content where WORK_EXHIBITION_NUMBER=?"
    var sql3 = "select * from exhibition where START_TIME<? AND END_TIME>?"
    var sql4 = "select * from bookmark where USER_ID=? AND EXHIBITION_NUMBER=?"
    var sql5 = "select * from exhibition_payment_record where USER_ID=? AND EXHIBITION_NUMBER=?"
    var sql6 = "select * from review where EXHIBITION_NUMBER=?"
    var sql7 = "select * from review_comments where EXHIBITION_NUMBER=?"
    var sql8 = "select avg(SCORE) from review where NUMBER=?"
    pool.getConnection((err, conn)=>{
        conn.query(sql3, [now, now], function(err, row3){
            console.log(row3.length);
            conn.query(sql,[number], function(err, row){
                    var start_date = new Array();
                    for (var sdc = 0; sdc < row.length; sdc ++){
                        start_date[sdc] = row[sdc].START_TIME.format('yyyy-MM-dd');
                    }
                    var end_date = new Array();
                    for (var edc = 0; edc < row.length; edc ++){
                        end_date[edc] = row[edc].END_TIME.format('yyyy-MM-dd');
                    }
                    conn.query(sql6, [row[0].NUMBER], function(err, row7){
                        var register_date = new Date(row[0].REGISTER_TIME);
                        for (var rt = 0; rt < row7.length; rt ++){
                            register_date[rt] = row7[rt].CREATE_TIME.format('yyyy-MM-dd a/p hh:mm:ss');
                        }
                    conn.query(sql7, [row[0].NUMBER], function(err, row8){
                        var re_reply = new Array();
                        for (var rr = 0; rr < row8.length; rr ++){
                            row8[rr].date = row8[rr].CREATE_TIME.format('yyyy-MM-dd a/p hh:mm:ss');
                        }
                        conn.query(sql8, [row[0].NUMBER], function(err, row9){
                            if (sess.user != undefined){
                                conn.query(sql2, [row[0].NUMBER], function(err, row2){
                                    conn.query(sql4, [sess.user.ID, number], function(err, row4){
                                        conn.query(sql5, [sess.user.ID, row[0].NUMBER], function(err, row5){
                                            if (row5[0] == undefined){
                                                res.render('main.ejs',{
                                                    title: "전시회 상세 페이지",
                                                    page: "board/exhibition_detail.ejs",
                                                    sess: sess,
                                                    row:row,
                                                    row2:row2,
                                                    row3:row3,
                                                    row4:row4,
                                                    row5:row5,
                                                    row7:row7,
                                                    start_date:start_date,
                                                    end_date,end_date,
                                                    now:now,
                                                    register_date:register_date,
                                                    row8:row8,
                                                    row9:row9,
                                                    re_reply:re_reply,
                                                })
                                                conn.release();
                                            } else {
                                                if(now < row5[row5.length - 1].END_VIEW_TIME){
                                                    var pay_now = 0;
                                                } else{
                                                    var pay_now = 1;
                                                }
                                                console.log(pay_now);
                                                res.render('main.ejs',{
                                                    title: "전시회 상세 페이지",
                                                    page: "board/exhibition_detail.ejs",
                                                    sess: sess,
                                                    row:row,
                                                    row2:row2,
                                                    row3:row3,
                                                    row4:row4,
                                                    row5:row5,
                                                    row7:row7,
                                                    start_date:start_date,
                                                    end_date,end_date,
                                                    now:now,
                                                    pay_now:pay_now,
                                                    register_date:register_date,
                                                    row8:row8,
                                                    row9:row9,
                                                    re_reply:re_reply,
                                                })
                                                conn.release();
                                            }
                                        })
                                    })
                                })
                            } else {
                                conn.query(sql2, [row[0].NUMBER], function(err, row2){
                                    res.render('main.ejs',{
                                        title: "전시회 상세 페이지",
                                        page: "board/exhibition_detail.ejs",
                                        sess: sess,
                                        row:row,
                                        row2:row2,
                                        row3:row3,
                                        row7:row7,
                                        start_date:start_date,
                                        end_date,end_date,
                                        register_date:register_date,
                                        row8:row8,
                                        row9:row9,
                                        re_reply:re_reply,
                                    })
                                    conn.release();
                                })
                            }
                        })
                    })
                })
            })
        })
    })
})

// 관리자 페이지 - 전시회 승인 O
router.get("/exhibition_approval", function(req, res){
    console.log("관리자 페이지");
    var sess = req.session;
    var date = new Date();
    var sql = "select * from exhibition where APPROVAL_WHETHER = 'A'"
    pool.getConnection((err, conn) => {
        conn.query(sql, function(err, row){
            if(err){
                console.log(sql);
                console.log(err)
            }
            if(row){
                var register_date = new Array();
                for (var rdc = 0; rdc < row.length; rdc ++){
                    register_date[rdc] = row[rdc].REGISTER_TIME.format('yyyy-MM-dd a/p hh:mm:ss');;
                }
                console.log(register_date);
                res.render('admin.ejs', {
                    title: "전시회 승인",
                    page: "admin/exhibition_approval.ejs",
                    sess:sess,
                    row:row,
                    register_date:register_date
                })
                conn.release();
            }
        })
    })
})

// 관리자 페이지 - 전시회 승인 상세 페이지 O
router.get("/approval_exhibition/:number", function(req, res){
    console.log("관리자 페이지");
    var number = req.params.number;
    var sess = req.session;
    var sql = "select * from exhibition where NUMBER = ?"
    pool.getConnection((err, conn) => {
        conn.query(sql, [number],function(err, row){
            if(err){
                console.log(sql);
                console.log(err)
            }
            if(row){
                var register_date = new Date(row[0].REGISTER_TIME);
                register_date = register_date.format('yyyy-MM-dd a/p hh:mm:ss');
                var daealine = new Date(row[0].DEADLINE);
                daealine = daealine.format('yyyy-MM-dd a/p hh:mm:ss');
                var start_time = new Date(row[0].START_TIME);
                start_time = start_time.format('yyyy-MM-dd a/p hh:mm:ss');
                var end_time = new Date(row[0].END_TIME);
                end_time = end_time.format('yyyy-MM-dd a/p hh:mm:ss');
                res.render('admin.ejs', {
                    title: "전시회 승인 상세 페이지",
                    page: "admin/approval_exhibition_detail.ejs",
                    sess:sess,
                    row:row,
                    register_date:register_date,
                    daealine: daealine,
                    start_time:start_time,
                    end_time:end_time
                })
                conn.release();
            }
        })
    })
})


// 유저 카드 O
router.get("/user_card", function(req, res){
    console.log("회원 카드");
    var sess = req.session;
    var sql = "select * from card where USER_ID = ?"
    pool.getConnection((err, conn) => {
        conn.query(sql, [sess.user.ID],function(err, row){
            if(err){
                console.log(sql);
                console.log(err)
            }
            if(row){
                console.log(row);
                res.render('main.ejs', {
                    title: sess.user.ID + " 카드",
                    page: "user/user_card.ejs",
                    sess:sess,
                    row:row,
                })
                conn.release();
            }
        })
    })
})

// 카드 정보 등록 O
router.get("/register_card", function(req, res){
    console.log("회원 카드 등록");
    var sess = req.session;
    res.render('main.ejs', {
        title: sess.user.ID + " 카드 등록",
        page: "user/register_card.ejs",
        sess:sess,
    })
})
// 카드 삭제 O
router.get("/delete_user_card/:number", function(req, res){
    var number = req.params.number;
    var sql_card_delete = "delete from card where NUMBER= ?"
    pool.getConnection((err, conn) => {
        conn.query(sql_card_delete, [number], function(err, row){
            if(err){
                console.log(err);
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8;" });
                res.write("<script> alert('카드 삭제에 문제가 있습니다..'); history.back(); </script>");
                return;
            }
            if(row){
                console.log("회원 카드 삭제");
                res.redirect("/user_card");
                conn.release();
                return;
            } else {
            }
        })
    })
})

// 전시회 승인 페이지(승인 완료) O
router.get("/yes_exhibition/:number", function(req, res){
    console.log("전시회 승인 완료");
    var sess = req.session;
    var sql = "update exhibition set APPROVAL_WHETHER=? where NUMBER=?";
    var number = req.params.number;
    pool.getConnection((err, conn) => {
        conn.query(sql,['Y',number], function(err, row){
            if(err){
                console.log(err);
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8;" });
                res.write("<script> alert('전시회 승인에 문제가 있습니다..'); history.back(); </script>");
                return;
            }
            if(row){
                console.log("전시회 승인");
                res.redirect("/exhibition_approval");
                conn.release();
                return;
            } else {
            }
        })
    })
})

// 전시회 거절 O
router.get("/no_exhibition/:number", function(req, res){
    console.log("전시회 거절");
    var sess = req.session;
    var number = req.params.number;
    res.render('admin.ejs', {
        title: "전시회 거절",
        page: "admin/rebuff_exhibition.ejs",
        sess:sess,
        number:number
    })
})

// 승인한 전시회 리스트 O
router.get("/approval_exhibition_yeslist", function(req, res){
    function addComma(num) {
        var regexp = /\B(?=(\d{3})+(?!\d))/g;
        return num.toString().replace(regexp, ',');
    }
    console.log("승인한 전시회 리스트");
    var sess = req.session;
    var sql = "select * from exhibition where APPROVAL_WHETHER='Y'"
    pool.getConnection((err, conn) => {
        conn.query(sql, function(err, row){
            if(err){
                console.log(sql);
                console.log(err);
            }
            if(row){
                var register_date = new Array();
                for (var rdc = 0; rdc < row.length; rdc ++){
                    register_date[rdc] = row[rdc].REGISTER_TIME.format('yyyy-MM-dd a/p hh:mm:ss');;
                }
                var start_date = new Array();
                for (var sdc = 0; sdc < row.length; sdc ++){
                    start_date[sdc] = row[sdc].START_TIME.format('yyyy-MM-dd a/p hh:mm:ss');;
                }
                var end_date = new Array();
                for (var edc = 0; edc < row.length; edc ++){
                    end_date[edc] = row[edc].END_TIME.format('yyyy-MM-dd a/p hh:mm:ss');;
                }
                var costarray = new Array();
                for (var edcc = 0; edcc < row.length; edcc ++){
                    costarray[edcc] = addComma(row[edcc].REGISTER_COST);
                }
                res.render('admin.ejs', {
                    title: "승인한 전시회 리스트",
                    page: "admin/approval_exhibition_yeslist.ejs",
                    sess:sess,
                    row:row,
                    register_date:register_date,
                    start_date:start_date,
                    end_date:end_date,
                    costarray:costarray
                })
                conn.release();
            }
        })
    })
})

// 거절한 전시회 리스트 O
router.get("/approval_exhibition_nolist", function(req, res){
    function addComma(num) {
        var regexp = /\B(?=(\d{3})+(?!\d))/g;
        return num.toString().replace(regexp, ',');
    }
    console.log("거절한 전시회 리스트");
    var sess = req.session;
    var sql = "select * from exhibition where APPROVAL_WHETHER='N'"
    pool.getConnection((err, conn) => {
        conn.query(sql, function(err, row){
            if(err){
                console.log(sql);
                console.log(err);
            }
            if(row){
                var register_date = new Array();
                for (var rdc = 0; rdc < row.length; rdc ++){
                    register_date[rdc] = row[rdc].REGISTER_TIME.format('yyyy-MM-dd a/p hh:mm:ss');;
                }
                var start_date = new Array();
                for (var sdc = 0; sdc < row.length; sdc ++){
                    start_date[sdc] = row[sdc].START_TIME.format('yyyy-MM-dd a/p hh:mm:ss');;
                }
                var end_date = new Array();
                for (var edc = 0; edc < row.length; edc ++){
                    end_date[edc] = row[edc].END_TIME.format('yyyy-MM-dd a/p hh:mm:ss');;
                }
                var costarray = new Array();
                for (var edcc = 0; edcc < row.length; edcc ++){
                    costarray[edcc] = addComma(row[edcc].REGISTER_COST);
                }
                res.render('admin.ejs', {
                    title: "거절한 전시회 리스트",
                    page: "admin/approval_exhibition_nolist.ejs",
                    sess:sess,
                    row:row,
                    register_date:register_date,
                    start_date:start_date,
                    end_date:end_date,
                    costarray:costarray
                })
                conn.release();
            }
        })
    })
})

/*전시회 결제 리스트 O */ 
router.get("/exhibition_payment_list", function(req, res){
    console.log("전시회 결제 리스트");
    function addComma(num) {
        var regexp = /\B(?=(\d{3})+(?!\d))/g;
        return num.toString().replace(regexp, ',');
    }
    var sess = req.session;
    var number = req.params.number;
    var sql = "select * from exhibition_registration_payment"
    pool.getConnection((err, conn) => {
        conn.query(sql, function(err, row){
            if(err){
                console.log(sql);
                console.log(err);
            }
            if(row){
                var register_date = new Array();
                for (var rdc = 0; rdc < row.length; rdc ++){
                    register_date[rdc] = row[rdc].TIME.format('yyyy-MM-dd a/p hh:mm:ss');;
                }
                var costarray = new Array();
                for (var edcc = 0; edcc < row.length; edcc ++){
                    costarray[edcc] = addComma(row[edcc].AMOUNT);
                }
                console.log(costarray);
                res.render('admin.ejs', {
                    title: "결제 리스트",
                    page: "admin/exhibition_payment_list.ejs",
                    sess:sess,
                    number:number,
                    row:row,
                    register_date:register_date,
                    costarray:costarray
                })
                conn.release();
            }
        })
    })
})

/* 공지사항 O */ 
router.get("/public", function(req, res){
    console.log("공지사항 메인");
    var sess = req.session;
    var sql = "select * from public"
    pool.getConnection((err, conn)=> {
        conn.query(sql, function(err, row){
            var register_date = new Array();
                for (var rdc = 0; rdc < row.length; rdc ++){
                    register_date[rdc] = row[rdc].CREATE_TIME.format('yyyy-MM-dd a/p hh:mm:ss');;
                }
                console.log(register_date);
            res.render('main.ejs', {
                title: "공지사항 메인",
                page: "public/public_main.ejs",
                sess:sess,
                row:row,
                register_date,register_date
            })
            conn.release();
        })
    })
})
// 공지사항 등록 O
router.get("/public_register", function(req, res){
    console.log("공지사항 등록");
    var sess = req.session;
    res.render('main.ejs', {
        title: "공지사항 등록",
        page: "public/public_register.ejs",
        sess:sess,
    })
})

// 공지사항 게시글 O
router.get("/public_post/:number", function(req, res){
    console.log("공지사항");
    var sess = req.session;
    var number = req.params.number;
    var sql = "select * from public where NUMBER =?"
    var sql2 = "select * from user where ID = ?"
    var hit_sql = "update public set HIT=? where NUMBER=?"
    pool.getConnection((err, conn)=>{
        conn.query(sql, [number], function(err, row){
            var register_date = new Array();
                for (var rdc = 0; rdc < row.length; rdc ++){
                    register_date[rdc] = row[rdc].CREATE_TIME.format('yyyy-MM-dd a/p hh:mm:ss');;
                }
            conn.query(sql2, [row[0].USER_ID], function(err, row2){
                conn.query(hit_sql, [row[0].HIT + 1,number], function(err, row3){
                    res.render('main.ejs', {
                        title: row[0].TITLE,
                        page: "public/public_post.ejs",
                        sess:sess,
                        row:row,
                        row2,row2,
                        row3,row3,
                        number:number,
                        register_date:register_date
                    })
                    conn.release();
                })
            })
        })
    })
})

// 지원 가능한 전시회 O
router.get("/supportable_exhibition", function(req, res){
    var sess = req.session;
    var now = new Date();
    console.log(now);
    var get_exhibition_date_sql = "select * from exhibition where APPROVAL_WHETHER='Y' AND DEADLINE > ?"
    pool.getConnection((err, conn)=>{
        conn.query(get_exhibition_date_sql, [now] , function(err, row){
            var deadline = new Array();
                for (var edc = 0; edc < row.length; edc ++){
                    deadline[edc] = row[edc].DEADLINE.format('yyyy-MM-dd a/p hh:mm:ss');;
            }
            var start_date = new Array();
                for (var sdc = 0; sdc < row.length; sdc ++){
                    start_date[sdc] = row[sdc].START_TIME.format('yyyy-MM-dd a/p hh:mm:ss');;
            }
            res.render('main.ejs', {
                title: "지원가능한 전시회",
                page: "board/supportable_exhibition.ejs",
                sess:sess,
                row:row,
                deadline:deadline,
                start_date:start_date
            })
            conn.release();
        })
    })
})

// 지원 가능한 전시회 - 상세 O
router.get("/supportable_exhibition_detail/:number", function(req, res){
    var sess = req.session;
    var number = req.params.number;
    var exhibition_detail_sql = "select * from exhibition where NUMBER=?"
    var work_count = "select * from work where EXHIBITION_NUMBER =?"
    pool.getConnection((err, conn) => {
        conn.query(exhibition_detail_sql, [number], function(err, row){
            conn.query(work_count, [number], function(err, row2){
                var deadline = new Array();
                    for (var edc = 0; edc < row.length; edc ++){
                        deadline[edc] = row[edc].DEADLINE.format('yyyy-MM-dd a/p hh:mm:ss');;
                }
                var start_date = new Array();
                    for (var sdc = 0; sdc < row.length; sdc ++){
                        start_date[sdc] = row[sdc].START_TIME.format('yyyy-MM-dd a/p hh:mm:ss');;
                }
                var end_date = new Array();
                    for (var edc = 0; edc < row.length; edc ++){
                        end_date[edc] = row[edc].END_TIME.format('yyyy-MM-dd a/p hh:mm:ss');;
                }
                console.log(row2.length);
                res.render('main.ejs', {
                    title: row[0].TITLE,
                    page: "board/supportable_exhibition_detail.ejs",
                    sess:sess,
                    row:row,
                    row2:row2,
                    deadline:deadline,
                    start_date:start_date,
                    end_date:end_date
                })
                conn.release();
            })
        })
    })
})

//전시회 전시작품 등록 신청하기 O
router.get("/exhibition_support_registration/:number", function(req, res){
    var sess = req.session;
    var number = req.params.number;
    var sql = "select * from exhibition where NUMBER=?"
    var sql2 = "select BOOTH_NUMBER from work where EXHIBITION_NUMBER=?"
    pool.getConnection((err, conn)=>{
        conn.query(sql, [number], function(err, row){
            conn.query(sql2, [number], function(err, row2){
                var work_array = new Array();
                for (var kz = 0; kz < row2.length; kz++){
                    work_array[row2[kz].BOOTH_NUMBER - 1] = row2[kz].BOOTH_NUMBER ;
                }
                res.render('main.ejs', {
                    title: row[0].TITLE,
                    page: "board/exhibition_support_registration.ejs",
                    sess:sess,
                    row:row,
                    row2:row2,
                    work_array:work_array
                })
                conn.release();
            })
        })
    })
})

// 주최한 전시회 - 현재 진행 중 O
router.get("/organized_exhibition_present", function(req, res){
    var sess = req.session;
    var now = new Date();
    var sql = "select * from exhibition where USER_ID=? AND APPROVAL_WHETHER='Y' AND START_TIME < ? AND END_TIME > ?"
    pool.getConnection((err, conn)=>{
        conn.query(sql, [sess.user.ID, now,  now], function(err, row){
            var start_date = new Array();
                for (var sdc = 0; sdc < row.length; sdc ++){
                    start_date[sdc] = row[sdc].START_TIME.format('yyyy-MM-dd');
            }
            var end_date = new Array();
                for (var edc = 0; edc < row.length; edc ++){
                    end_date[edc] = row[edc].END_TIME.format('yyyy-MM-dd');
            }
            console.log(row);
            res.render('main.ejs', {
                title: "내가 주최한 전시회 / 현재 진행 중",
                page: "board/organized_exhibition_present.ejs",
                sess:sess,
                row:row,
                start_date:start_date,
                end_date:end_date
            })
            conn.release();
        })
    })
})

// 주최한 전시회 - 대기중인 전시회 O
router.get("/organized_exhibition_prepare", function(req, res){
    var sess = req.session;
    function addComma(num) {
        var regexp = /\B(?=(\d{3})+(?!\d))/g;
        return num.toString().replace(regexp, ',');
    }
    var now = new Date();
    var sql = "select * from exhibition where USER_ID=? AND START_TIME > ? AND APPROVAL_WHETHER='Y'"
    pool.getConnection((err, conn)=>{
        conn.query(sql, [sess.user.ID, now], function(err, row){
            var start_date = new Array();
                for (var sdc = 0; sdc < row.length; sdc ++){
                    start_date[sdc] = row[sdc].START_TIME.format('yyyy-MM-dd');
            }
            var end_date = new Array();
                for (var edc = 0; edc < row.length; edc ++){
                    end_date[edc] = row[edc].END_TIME.format('yyyy-MM-dd');
            }
            var costarray = new Array();
                for (var edcc = 0; edcc < row.length; edcc ++){
                    costarray[edcc] = addComma(row[edcc].REGISTER_COST);
            }
            res.render('main.ejs', {
                title: "내가 주최한 전시회 / 대기중인 전시회",
                page: "board/organized_exhibition_prepare.ejs",
                sess:sess,
                row:row,
                start_date:start_date,
                end_date:end_date,
                costarray:costarray
            })
            conn.release();
        })
    })
})
// 주최한 전시회 - 승인 대기 중 O
router.get("/organized_exhibition_ready_app", function(req, res){
    var sess = req.session;
    var sql = "select * from exhibition where USER_ID=? AND APPROVAL_WHETHER='A'"
    pool.getConnection((err, conn)=>{
        conn.query(sql, [sess.user.ID], function(err, row){
            var register_date = new Array();
                for (var rdc = 0; rdc < row.length; rdc ++){
                    register_date[rdc] = row[rdc].REGISTER_TIME.format('yyyy-MM-dd');
            }
            var start_date = new Array();
                for (var sdc = 0; sdc < row.length; sdc ++){
                    start_date[sdc] = row[sdc].START_TIME.format('yyyy-MM-dd');
            }
            var end_date = new Array();
                for (var edc = 0; edc < row.length; edc ++){
                    end_date[edc] = row[edc].END_TIME.format('yyyy-MM-dd');
            }
            var costarray = new Array();
                for (var edcc = 0; edcc < row.length; edcc ++){
                    costarray[edcc] = addComma(row[edcc].REGISTER_COST);
            }
            res.render('main.ejs', {
                title: "내가 주최한 전시회 / 승인 대기 중",
                page: "board/organized_exhibition_ready_app.ejs",
                sess:sess,
                row:row,
                start_date:start_date,
                end_date:end_date,
                costarray:costarray,
                register_date:register_date
            })
            conn.release();
        })
    })
})

// 주최한 전시회 - 승인된 전시회 O
router.get("/organized_exhibition_approval", function(req, res){
    var sess = req.session;
    var now = new Date();
    var sql = "select * from exhibition where USER_ID=? AND APPROVAL_WHETHER='Y'"
    pool.getConnection((err, conn)=>{
        conn.query(sql, [sess.user.ID, now], function(err, row){
            var register_date = new Array();
                for (var rdc = 0; rdc < row.length; rdc ++){
                register_date[rdc] = row[rdc].REGISTER_TIME.format('yyyy-MM-dd');
            }
            var start_date = new Array();
                for (var sdc = 0; sdc < row.length; sdc ++){
                start_date[sdc] = row[sdc].START_TIME.format('yyyy-MM-dd');
            }
            var end_date = new Array();
                for (var edc = 0; edc < row.length; edc ++){
                end_date[edc] = row[edc].END_TIME.format('yyyy-MM-dd');
            }
            var costarray = new Array();
                for (var edcc = 0; edcc < row.length; edcc ++){
                costarray[edcc] = addComma(row[edcc].REGISTER_COST);
            }
            res.render('main.ejs', {
                title: "내가 주최한 전시회 / 승인된 전시회",
                page: "board/organized_exhibition_approval.ejs",
                sess:sess,
                row:row,
                start_date:start_date,
                end_date:end_date,
                costarray:costarray,
                register_date:register_date
            })
            conn.release();
        })
    })
})

// 주최한 전시회 - 거절된 전시회 O
router.get("/organized_exhibition_rebuff", function(req, res){
    var sess = req.session;
    var now = new Date();
    var sql = "select * from exhibition where USER_ID=? AND APPROVAL_WHETHER='N'"
    pool.getConnection((err, conn)=>{
        conn.query(sql, [sess.user.ID, now], function(err, row){
            var register_date = new Array();
                for (var rdc = 0; rdc < row.length; rdc ++){
                register_date[rdc] = row[rdc].REGISTER_TIME.format('yyyy-MM-dd');
            }
            var start_date = new Array();
                for (var sdc = 0; sdc < row.length; sdc ++){
                start_date[sdc] = row[sdc].START_TIME.format('yyyy-MM-dd');
            }
            var end_date = new Array();
                for (var edc = 0; edc < row.length; edc ++){
                end_date[edc] = row[edc].END_TIME.format('yyyy-MM-dd');
            }
            var costarray = new Array();
                for (var edcc = 0; edcc < row.length; edcc ++){
                costarray[edcc] = addComma(row[edcc].REGISTER_COST);
            }
            res.render('main.ejs', {
                title: "내가 주최한 전시회 / 거절된 전시회",
                page: "board/organized_exhibition_rebuff.ejs",
                sess:sess,
                row:row,
                start_date:start_date,
                end_date:end_date,
                costarray:costarray,
                register_date:register_date
            })
            conn.release();
        })
    })
})

// 주최한 전시회 - 종료된 전시회 O
router.get("/organized_exhibition_end", function(req, res){
    var sess = req.session;
    var now = new Date();
    var sql = "SELECT * FROM exhibition where USER_ID=? AND END_TIME < ? AND APPROVAL_WHETHER='Y'"
    pool.getConnection((err, conn)=>{
        conn.query(sql, [sess.user.ID, now], function(err, row){
            var start_date = new Array();
                for (var sdc = 0; sdc < row.length; sdc ++){
                start_date[sdc] = row[sdc].START_TIME.format('yyyy-MM-dd');
            }
            var end_date = new Array();
                for (var edc = 0; edc < row.length; edc ++){
                    if( row[edc].END_TIME < now){
                        console.log("끝남")
                    }
                end_date[edc] = row[edc].END_TIME.format('yyyy-MM-dd');
            }
            console.log(row);
            res.render('main.ejs', {
                title: "내가 주최한 전시회 / 종료된 전시회",
                page: "board/organized_exhibition_end.ejs",
                sess:sess,
                row:row,
                end_date:end_date
            })
            conn.release();
        })
    })
})

// 주최한 전시회 전시작품 승인 O
router.get("/organized_exhibition_prepare_detail/:number", function(req, res){
    var number = req.params.number;
    console.log("ㅎㅇㅎㅇ");
    var sess = req.session;
    var sql = "select * from exhibition where NUMBER=?"
    var sql2 = "SELECT * FROM db_design_2020.work where EXHIBITION_NUMBER=?"
    var sql3 = "SELECT * FROM db_design_2020.work_content where WORK_EXHIBITION_NUMBER=? "
    pool.getConnection((err, conn) => {
        conn.query(sql, [number], function(err, row){
            conn.query(sql2, [number], function(err, row2){
                conn.query(sql3, [number], function(err, row3){
                    var deadline = new Array();
                    deadline[0] = row[0].DEADLINE.format('yyyy년 MM월 dd일');
                    var start_date = new Array();
                    start_date[0] = row[0].START_TIME.format('yyyy년 MM월 dd일');
                    var end_date = new Array();
                    end_date[0] = row[0].END_TIME.format('yyyy년 MM월 dd일');
                    res.render('main.ejs', {
                        title: "내가 주최한 전시회 / 종료된 전시회",
                        page: "board/organized_exhibition_prepare_detail.ejs",
                        sess:sess,
                        row:row,
                        row2:row2,
                        row3:row3,
                        start_date:start_date,
                        end_date:end_date,
                        deadline:deadline
                    })
                    conn.release();
                })
            })
        })
    }) 
})

// 전시회 감상하기 O
router.get("/view_work/:number", function(req, res){
    var sess = req.session;
    var number= req.params.number.split("=")[0];
    var booth = req.params.number.split("=")[1];
    // 전시회 불러오기
    var sql = "select * from exhibition where NUMBER=?"
    var sql2 = "select * from work where EXHIBITION_NUMBER=? AND BOOTH_NUMBER=?"
    var sql3 = "select * from user where ID=?"
    var sql4 = "update exhibition set HIT=? where NUMBER=?";
    var sql5 = "insert into exhibition_view_record (USER_ID, EXHIBITION_NUMBER, VIEW_TIME) values( ?, ?, ?)";
    var sql6 = "select * from user_favorite where MAKER_ID=? AND USER_ID=?"
    var sql7 = "select * from work_content where WORK_EXHIBITION_NUMBER=? AND BOOTH_NUMBER=?"
    var sql8 = "SELECT * FROM review where USER_ID=? AND EXHIBITION_NUMBER=?;"
    var sql9 = "SELECT * from exhibition_payment_record where USER_ID=? AND EXHIBITION_NUMBER=?"
    var sql10 = "update exhibition_payment_record set VIEW_STATUS=? where NUMBER=?";
    var now = new Date();
    pool.getConnection((err, conn)=>{
        // 전시회
        conn.query(sql, [number], function(err, row){
            console.log(row);
            // 전시작품
            conn.query(sql2, [number, booth], function(err, row2){
                // 전시작품
                conn.query(sql7, [number, booth], function(err, row7){
                    // 유저 정보
                    conn.query(sql3, [row2[0].USER_ID], function(err, row3){
                        // 조회수
                        console.log(row3);
                        conn.query(sql4, [row[0].HIT + 1, number], function(err, row4){
                            // 조회 기록
                            conn.query(sql5, [sess.user.ID, number, now], function(err, row5){
                                conn.query(sql6, [row3[0].ID, sess.user.ID], function(err, row6){
                                    // 리뷰 작성 여부
                                    conn.query(sql8, [sess.user.ID, row[0].NUMBER], function(err, row8){
                                        // 구매기록 가져오기
                                        conn.query(sql9, [sess.user.ID, number], function(err, row9){
                                            // 구매기록 가져오기
                                            conn.query(sql10, ['Y' ,row9[row9.length - 1].NUMBER], function(err, row9){
                                                // 구매기록 가져오기
                                                console.log(row7);
                                                res.render('main.ejs', {
                                                    title: "전시작품",
                                                    page: "board/view_work.ejs",
                                                    sess:sess,
                                                    row:row,
                                                    row2:row2,
                                                    row3:row3,
                                                    row4:row4,
                                                    row6:row6,
                                                    row7:row7,
                                                    row8:row8,
                                                    booth:booth
                                                })
                                                conn.release();
                                            })
                                        })
                                    })
                                })
                            })
                        })
                    })
                })
            })
        })
    })
})

// 고객 즐겨찾기 X
router.get("/exbigition_category_register/:number", function(req, res){
    var sess = req.session;
    var number = req.params.number;
    var sql = "select * from bookmark where USER_ID=? AND EXHIBITION_NUMBER=?"
    var sql1 = "insert into bookmark (USER_ID, EXHIBITION_NUMBER) values(?, ?)"
    var sql2 = "delete from bookmark where USER_ID = ? and EXHIBITION_NUMBER = ?"
    pool.getConnection((err, conn)=>{
        conn.query(sql, [sess.user.ID, number], function(err, row){
            if(row[0] == undefined){
                console.log("즐겨찾기 추가");
                conn.query(sql1, [sess.user.ID, number,], function(err, row2){
                    res.redirect("/exhibition_detail/"+number);
                    conn.release();
                })
            }
            if(row[0] != undefined){
                conn.query(sql2, [sess.user.ID, number,], function(err, row2){
                    res.redirect("/exhibition_detail/"+number);
                    conn.release();
                })
            }
        })
    })
})

// 전시회 구매
router.get("/exhibition_purchase_card/:number", function(req, res){
    var sess = req.session;
    var number = req.params.number;
    var sql = "select * from exhibition_payment_record where USER_ID=? AND EXHIBITION_NUMBER=?"
    var sql2 = "select * from exhibition where NUMBER=?"
    var sql3 = "select * from work_content where WORK_EXHIBITION_NUMBER=?"
    pool.getConnection((err, conn)=>{
        conn.query(sql, [sess.user.ID, number], function(err, row){
            conn.query(sql2, [number], function(err, row2){
                conn.query(sql3, [number], function(err, row3){
                    start_date = row2[0].START_TIME.format('yyyy-MM-dd');
                    end_date = row2[0].END_TIME.format('yyyy-MM-dd');
                    res.render('main.ejs', {
                        title: "전시회 구매",
                        page: "board/exhibition_purchase.ejs",
                        sess:sess,
                        row:row,
                        row2:row2,
                        row3:row3,
                        start_date:start_date,
                        end_date:end_date
                    })
                    conn.release();
                })
            })
        })
    })
})

// 전시회 구매 - 카드
router.get("/exhibition_purchase_card_second/:number", function(req, res){
    var sess = req.session;
    var number = req.params.number;
    var sql = "select * from exhibition where NUMBER=?"
    var sql2 = "select * from card where USER_ID=?"
    pool.getConnection((err, conn)=>{
        conn.query(sql, [number], function(err, row){
            conn.query(sql2, [sess.user.ID, number], function(err, row2){
                console.log(row);
                if(row2[0] == undefined){
                    res.redirect("/register_card");
                    conn.release();
                } else {
                    res.render('main.ejs', {
                        title: "전시회 구매 카드",
                        page: "board/exhibition_purchase_card_second.ejs",
                        sess:sess,
                        row:row,
                        row2,row2,
                    })
                    conn.release();
                }
            })
        })
    })
})

// 전시회 관람 카드 결제 마지막
router.get("/exhibition_purchase_card_final/:para", function(req, res){
    var sess = req.session;
    var para = req.params.para;
    var number = para.split("=")[0];
    var price = para.split("=")[1];
    var card_number = para.split("=")[2];
    var now = new Date();
    var endtime = new Date();
    var endtime = endtime.setDate(endtime.getDate() + 3);
    endtime = new Date(endtime);
    var sql = "insert into exhibition_payment_record (USER_ID, EXHIBITION_NUMBER, TIME, PAYMENT_TYPE, PAYMENT_AMOUNT, CARD_NUMBER , END_VIEW_TIME) values (?, ?, ?, '카드', ?, ?, ?)"
    pool.getConnection((err, conn)=>{
        console.log("ㅎㅇ");
        conn.query(sql, [sess.user.ID, number, now, price, card_number ,endtime], function(err, row){
            res.redirect("/view_work/"+number+"=1");
            conn.release();
        })
    })
})

// 전시회 즐겨찾기
router.get("/bookmark", function(req, res){
    var sess = req.session;
    var sql = "select * from exhibition where NUMBER IN (select bookmark.EXHIBITION_NUMBER from bookmark where USER_ID=?)"
    pool.getConnection((err, conn)=>{
        conn.query(sql, [sess.user.ID], function(err, row){
            console.log(row);
            res.render('main.ejs', {
                title: "즐겨찾기",
                page: "board/bookmark.ejs",
                sess:sess,
                row:row,
            })
            conn.release();
        })
    })
})

// 유저 즐겨찾기
router.get("/bookmark_user", function(req, res){
    var sess = req.session;
    var sql = "select * from user where ID IN (select user_favorite.MAKER_ID from user_favorite where USER_ID=?)"
    pool.getConnection((err, conn)=>{
        conn.query(sql, [sess.user.ID], function(err, row){
            console.log(row)
            res.render('main.ejs', {
                title: "즐겨찾기",
                page: "board/bookmark_user.ejs",
                sess:sess,
                row:row,
            })
            conn.release();
        })
    })
})

// 유저 즐겨찾기 X
router.get("/exbigition_category_register_bookmark/:number", function(req, res){
    var sess = req.session;
    var number = req.params.number;
    var sql = "select * from bookmark where USER_ID=? AND EXHIBITION_NUMBER=?"
    var sql1 = "insert into bookmark (USER_ID, EXHIBITION_NUMBER) values(?, ?)"
    var sql2 = "delete from bookmark where USER_ID = ? and EXHIBITION_NUMBER = ?"
    pool.getConnection((err, conn)=>{
        conn.query(sql, [sess.user.ID, number], function(err, row){
            if(row[0] == undefined){
                console.log("즐겨찾기 추가");
                conn.query(sql1, [sess.user.ID, number,], function(err, row2){
                    res.redirect("/bookmark");
                    conn.release();
                })
            }
            if(row[0] != undefined){
                conn.query(sql2, [sess.user.ID, number,], function(err, row2){
                    res.redirect("/bookmark");
                    conn.release();
                })
            }
        })
    })
})

// 리뷰 작성
router.get("/register_review/:number", function(req, res){
    var sess = req.session;
    var number = req.params.number;
    var sql = "select * from exhibition where NUMBER=?"
    pool.getConnection((err, conn)=> {
        conn.query(sql, [number], function(err, row){
            if(err){
                console.log(sql);
                console.log(err);
            }
            if(row){
                res.render('main.ejs', {
                    title: "리뷰작성",
                    page: "board/register_review.ejs",
                    sess:sess,
                    row:row,
                    number:number
                })
                conn.release();
            }
        })
    })
})
// 전시회 관람 기록
router.get("/viewing_record", function(req, res){
    var sess = req.session;
    var sql = "select * from exhibition_view_record where USER_ID=?"
    pool.getConnection((err, conn)=> {
        conn.query(sql, [sess.user.ID], function(err, row){
            if(err){
                console.log(sql);
                console.log(err);
            }
            if(row){
                var view_time = new Array();
                for (var edc = 0; edc < row.length; edc ++){
                    view_time[edc] = row[edc].VIEW_TIME.format('yyyy-MM-dd a/p hh:mm:ss');;
                }
                console.log(row);
                res.render('main.ejs', {
                    title: "관람기록",
                    page: "board/viewing_record.ejs",
                    sess:sess,
                    row:row,
                    view_time:view_time
                })
                conn.release();
            }
        })
    })
})

// 유저 즐겨찾기 추가/삭제
router.get("/user_favorite_change/:para", function(req, res){
    var para = req.params.para;
    console.log(para);
    var sess = req.session;
    var sql = "select * from user_favorite where MAKER_ID=? AND USER_ID=?"
    var sql2 = "insert into user_favorite (MAKER_ID, USER_ID) values(?, ?)";
    var sql3 = "delete from user_favorite where MAKER_ID=? AND USER_ID=?"
    pool.getConnection((err, conn)=>{
        conn.query(sql, [para, sess.user.ID], function(err, row){
            console.log("ㅎㅇㅎㅇ");
            if(row[0] == undefined){
                conn.query(sql2, [para, sess.user.ID], function(err, row2){
                    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8;" });
                    res.write("<script> alert('즐겨찾기에 해당 작가가 추가되었습니다..'); history.back(); </script>");
                    conn.release();
                    return;
                })
            } else {
                conn.query(sql3, [para, sess.user.ID], function(err, row2){
                    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8;" });
                    res.write("<script> alert('즐겨찾기에서 삭제되었습니다..'); history.back(); </script>");
                    conn.release();
                    return;
                })
            }
        })
    })
})

// 요금제 결제
router.get("/payment_of_charges/:para", function(req, res){
    var para = req.params.para;
    var sess = req.session;
    var sql = "select * from card where USER_ID=?"
    pool.getConnection((err, conn) => {
        conn.query(sql, [sess.user.ID], function(err, row){
            console.log(row);
            res.render('main.ejs', {
                title: "요금제 결제",
                page: "user/payment_of_charges.ejs",
                sess:sess,
                para:para,
                row:row
            })
            conn.release();
        })
    })
})

// 요금제 결제 마무리
router.get("/payment_of_charges_page/:para", function(req, res){
    var para = req.params.para;
    var sess = req.session;
    var card = para.split('=')[0];
    var view_count  = parseInt(para.split('=')[1]);
    var cost = parseInt(para.split('=')[2].replace(',',''));
    var grage = para.split('=')[3];
    var now = new Date();
    var sql = "insert into payment_system_record (USER_ID, CARD_NUMBER, PAYMENT_TIME, PAYMENT_AMOUNT, VIEWING_AVA_COUNT) values (?,?,?,?,?)"
    var sql2 = "update user set GRADE=?,VIEWING_AVA_COUNT=? where ID=?";
    var sess_update = "SELECT * FROM user where ID=? and PWD=?";
    pool.getConnection((err, conn) => {
        conn.query(sql ,[sess.user.ID, card, now, cost, view_count], function(err, row){
            conn.query(sql2 ,[grage, sess.user.VIEWING_AVA_COUNT + view_count ,sess.user.ID], function(err, row2){
                if(err){
                    console.log(sql);
                    console.log(err);
                    conn.release;
                }
                console.log(sess.user.ID);
                if(row2){
                    conn.query(sess_update, [sess.user.ID, sess.user.PWD], function(err, info2){
                        sess.user = info2[0];
                        res.redirect('/mypage');
                        conn.release;
                        return;
                    })
                }
            })
        })
    })
})

// 결제 기록 보기
router.get("/payment_record", function(req, res){
    var sess = req.session;
    var sql = "select * from payment_system_record where USER_ID=?"
    pool.getConnection((err, conn)=>{
        conn.query(sql, [sess.user.ID], function(err, row){
            var pay_record = new Array();
            for (var i = 0; i < row.length; i++){
                pay_record[i] = row[i].PAYMENT_TIME.format('yyyy-MM-dd a/p hh:mm:ss');
            }
            var costarray = new Array();
            for (var edcc = 0; edcc < row.length; edcc ++){
                costarray[edcc] = addComma(row[edcc].PAYMENT_AMOUNT);
            }
            console.log(row);
            res.render('main.ejs', {
                title: "요금제 결제 기록",
                page: "user/payment_record.ejs",
                sess:sess,
                row:row,
                pay_record:pay_record,
                costarray:costarray
            })
            conn.release();
        })
    })
})

// 결제 기록 보기
router.get("/comment_update/:para", function(req, res){
    var sess = req.session;
    var para = req.params.para;
    var now = new Date();
    var number = para.split('=')[0];
    var content = para.split('=')[1];
    var exhibi_no = para.split('=')[2];
    var sql = "insert into review_comments (EXHIBITION_NUMBER, REVIEW_NUMBER, USER_ID, CONTENT, CREATE_TIME) values(?, ?, ?, ?, ?)";
    console.log("ㅎㅇㅎㅇ");
    pool.getConnection((err, conn)=>{
        console.log(number);
        conn.query(sql, [exhibi_no, number, sess.user.ID, content, now], function(err, row){
            res.redirect("/exhibition_detail/"+exhibi_no);
            conn.release();
        })
    })
})

// 전시회 구매 - 카드
router.get("/exhibition_purchase_coupon/:number", function(req, res){
    var sess = req.session;
    var number = req.params.number.split('=')[0];
    var choice = req.params.number.split('=')[1];
    var now = new Date();
    var endtime = new Date();
    var endtime = endtime.setDate(endtime.getDate() + 3);
    endtime = new Date(endtime);
    var sql = "update user set VIEWING_AVA_COUNT=? where ID=?";
    var sql2 = "insert into exhibition_payment_record (USER_ID, EXHIBITION_NUMBER, TIME, PAYMENT_TYPE, END_VIEW_TIME) values (?,?,?,'관람권',?)"
    pool.getConnection((err, conn)=>{
        conn.query(sql, [sess.user.VIEWING_AVA_COUNT - 1 ,sess.user.ID ], function(err, row){
            conn.query(sql2, [sess.user.ID, number, now  ,endtime], function(err, row){
                if (choice == 'yes'){
                    res.redirect("/view_work/" + number + '=1');
                    conn.release();
                } else {
                    res.redirect("/main");
                    conn.release();
                }
            })
        })
    })
})

// 구매한 전시회 - 카드
router.get("/purchase_record", function(req, res){
    var sess = req.session;
    var sql = "select * from exhibition_payment_record where USER_ID=?"
    pool.getConnection((err, conn)=>{
        conn.query(sql, [sess.user.ID], function(err, row){
            var time = new Array();
            for (var edc = 0; edc < row.length; edc ++){
                time[edc] = row[edc].TIME.format('yyyy-MM-dd a/p hh:mm:ss');;
            }
            res.render('main.ejs', {
                title: "구매한 전시회",
                page: "user/purchase_record.ejs",
                sess:sess,
                row:row,
                time:time
            })
            conn.release();
        })
    })
})

// 구매한 전시회 - 카드
router.get("/compensating/:number", function(req, res){
    var sess = req.session;
    var number = req.params.number;
    var sql = "select * from exhibition_payment_record where NUMBER=?"
    pool.getConnection((err, conn)=>{
        conn.query(sql, [number], function(err, row){
            var time = new Array();
            for (var edc = 0; edc < row.length; edc ++){
                time[edc] = row[edc].TIME.format('yyyy-MM-dd a/p hh:mm:ss');
            }
            res.render('main.ejs', {
                title: "구매한 전시회",
                page: "user/compensating.ejs",
                sess:sess,
                row:row,
                time:time
            })
            conn.release();
        })
    })
})

// 진행중이 전시회 상세
router.get('/organized_present_detail/:number', function(req, res){
    var sess = req.session;
    var number = req.params.number;
    var sql2 = "SELECT * FROM db_design_2020.exhibition where NUMBER=? "
    var sql = "SELECT PAYMENT_AMOUNT FROM db_design_2020.exhibition_payment_record where EXHIBITION_NUMBER=?"
    var sql3 = "SELECT * FROM db_design_2020.exhibition_payment_record where EXHIBITION_NUMBER=? AND PAYMENT_TYPE='관람권'"
    pool.getConnection((err, conn) => {
        conn.query(sql, [number], function(err, row){
            conn.query(sql2, [number], function(err, row2){
                conn.query(sql3, [number], function(err, row3){
                    var start = row2[0].START_TIME.format('yyyy-MM-dd a/p hh:mm:ss');
                    var end = row2[0].END_TIME.format('yyyy-MM-dd a/p hh:mm:ss');
                    var propit = 0;
                    for (var i = 0; i < row.length; i++){
                        propit = propit + row[i].PAYMENT_AMOUNT;
                    }
                    propit = addComma(propit);
                    res.render('main.ejs', {
                        title: number+"번 전시회 상세",
                        page: "board/organized_exhibition_prepare_detail.ejs",
                        sess:sess,
                        row:row,
                        row2:row2,
                        row3:row3,
                        start:start,
                        end:end,
                        propit:propit
                    })
                    conn.release();
                })
            })
        })
    })
})

// 종료된 전시회 상세
router.get('/exhibition_end_detail/:number', function(req, res){
    var sess = req.session;
    var number = req.params.number;
    var sql = "select * from exhibition where NUMBER=?"
    var sql2 = "select * from exhibition_payment_record where EXHIBITION_NUMBER=?"
    pool.getConnection((err, conn) => {
        conn.query(sql, [number], function(err, row){
            conn.query(sql2, [number, 0], function(err, row2){
                var start = row[0].START_TIME.format('yyyy-MM-dd a/p hh:mm:ss');
                var end = row[0].END_TIME.format('yyyy-MM-dd a/p hh:mm:ss');
                var propit = 0;
                var count_coupon = 0;
                var count_price = 0;
                for (var i = 0; i < row2.length; i++){
                    console.log(row2[i].PAYMENT_AMOUNT);
                    if(row2[i].PAYMENT_TYPE != '카드'){
                        count_coupon = count_coupon + 1;
                    }
                    if(row2[i].PAYMENT_TYPE == '카드'){
                        count_price = count_price + row[0].PRODUCTION_COST;
                    }
                }
                var start_date = row[0].START_TIME.format('yyyy-MM-dd');
                var end_date = row[0].END_TIME.format('yyyy-MM-dd');
                propit = propit + row[0].PRODUCTION_COST;
                propit = addComma(propit);
                count_price = addComma(count_price);
                res.render('main.ejs', {
                    title: number+"번 전시회 상세",
                    page: "board/exhibition_end_detail.ejs",
                    sess:sess,
                    row:row,
                    start:start,
                    end:end,
                    propit:propit,
                    count_coupon:count_coupon,
                    count_price:count_price,
                    start_date:start_date,
                    end_date:end_date
                })
                conn.release();
            })
        })
    })
})


// 종료된 전시회 정산
router.get('/closing_exhibition_settlement/:number', function(req,res){
    var sess= req.session;
    var number = req.params.number; 
    var now = new Date();
    var sql1 = "select * from exhibition where NUMBER=?"
    var sql2 = "select * from work where EXHIBITION_NUMBER=?;"
    var sql3 = "select * from exhibition_payment_record where EXHIBITION_NUMBER=?"
    var sql4 = "insert into work_calculate (USER_ID, WORK_NUMBER, EXHIBITION_NUMBER, TIME, AMOUNT) values( ?, ?, ?, ?, ?)";
    var sql5 = "update exhibition set INITIAL_SETTLEMENT=? where NUMBER=?";
    var sql6 = 'insert into work_calculate (USER_ID, EXHIBITION_NUMBER, TIME, AMOUNT) values(?,?,?,?)'
    pool.getConnection((err, conn) => {
        // 전시회
        conn.query(sql1 ,[number], function(err, row){
            // 전시작품
            conn.query(sql2 ,[number], function(err, row2){
                // 결제 내역
                conn.query(sql3 ,[number], function(err, row3){
                    // 총 합산 금액 정산
                    var result_profits = 0;
                    for (var i = 0; i < row3.length; i ++){
                        if (row3[i].PAYMENT_TYPE == "카드"){
                            result_profits = result_profits + row[0].PRODUCTION_COST;
                        }
                        if (row3[i].PAYMENT_TYPE == "관람권"){
                            result_profits = result_profits + 20000;
                        }
                    }
                    var host_money = result_profits * 0.2;
                    conn.query(sql6, [sess.user.ID, row[0].NUMBER, now, host_money], function(err, row5){

                    })
                    // 분배금 전시작품등록자
                    var distribution_money = (result_profits * 0.6) / row2.length;
                    conn.query(sql5, ['Y', number], function(err, row5){

                    })
                    console.log(row2.length);
                    for (var j = 0; j < row2.length; j ++){
                        conn.query(sql4, [row2[j].USER_ID, row2[j].NUMBER, row2[j].EXHIBITION_NUMBER, now, distribution_money], function(err, row4){

                        })
                    }
                    res.redirect('/organized_exhibition_end');
                    conn.release();
                })
            })
        })
    })
})

// 종료된 전시회
router.get('/end_exhibition', function(req,res){
    var sess= req.session;
    var now = new Date();
    var sql = "select * from exhibition where END_TIME < 0 AND APPROVAL_WHETHER='Y'"
    pool.getConnection((err, conn) => {
        conn.query(sql, function(err, row){
            console.log(row[0]);
            res.render('main.ejs', {
                title: "종료된 전시회",
                page: "board/end_exhibition.ejs",
                sess:sess,
                row:row,
            })
            conn.release();
        })
    })
})

// 보유 금액 정산
router.get('/settlement_of_holding_amount', function(req, res){
    var sess= req.session;
    var sql = "SELECT * FROM db_design_2020.work_calculate where USER_ID=?"
    pool.getConnection((err, conn) => {
        conn.query(sql, [sess.user.ID], function(err, row){
            var amount = 0;
            for (var i = 0; i < row.length; i ++){
                amount = amount + row[i].AMOUNT
            }
            amount = amount - sess.user.HAVE_AMOUNT;
            res.render('main.ejs', {
                title: "전시회 정산",
                page: "board/settlement_of_holding_amount.ejs",
                row:row,
                sess:sess,
                amount:amount
            })
            conn.release();
        })
    })
})

// 보유 금액 정산
router.get('/settlement_of_holding_amount_record', function(req, res){
    var sess= req.session;
    var sql = "SELECT * FROM db_design_2020.exhibition_calculate where USER_ID=?"
    pool.getConnection((err, conn) => {
        conn.query(sql, [sess.user.ID], function(err, row){
            var time = new Array();
            for (var edc = 0; edc < row.length; edc ++){
                time[edc] = row[edc].TIME.format('yyyy-MM-dd a/p hh:mm:ss');
            }
            // var price = new Array();
            // for (var pr = 0; pr < row.length; pr ++){
            //     price[pr] = price[pr].addComma(row[i].AMOUNT);
            // }
            var result_amount = 0;
            for (var ra = 0; ra < row.length; ra++){
                result_amount = result_amount + row[ra].AMOUNT;
            }
            res.render('main.ejs', {
                title: "전시회 정산",
                page: "board/settlement_of_holding_amount_record.ejs",
                row:row,
                sess:sess,
                time:time,
                // price:price,
                result_amount:result_amount
            })
            conn.release();
        })
    })
})
module.exports = router;
