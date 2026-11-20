var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');
var MySQLStore = require('express-mysql-session')(session);
var multer = require('multer');
var bodyParser = require('body-parser')


var _storage = multer.diskStorage({
  destination: function (req, file, cb){
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb){
    cb(null, file.originalname)
  }
})
var upload = multer({storage: _storage})


var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var boardRouter = require('./routes/board');
var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// 정적 파일은 화면이 실제로 쓰는 폴더만 내보낸다.
// 예전처럼 프로젝트 폴더 전체를 열어 두면 app.js · routes · config/dbconfig.js(DB 비밀번호)까지 누구나 받을 수 있다.
// redirect: false — /public 처럼 폴더 이름과 같은 주소를 /public/ 로 돌리지 않고 라우터(공지사항)로 넘긴다
var STATIC_OPTIONS = { redirect: false };
app.use('/public', express.static(path.join(__dirname, 'public'), STATIC_OPTIONS));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), STATIC_OPTIONS));
app.use('/category_img', express.static(path.join(__dirname, 'category_img'), STATIC_OPTIONS));
app.get('/favicon.ico', function (req, res) {
  res.sendFile(path.join(__dirname, 'favicon.ico'));
});

app.use(session({
  secret: 'fdasj#@U!&#%#$',
  resave: false,
  saveUninitialized: true,   // 세션이 필요하기전까진 세션을 실행하지 않겠다
}))

app.use('/users', express.static(path.join(__dirname, 'uploads'), STATIC_OPTIONS));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/board', boardRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.status = err.status || 500;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
