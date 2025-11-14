// pethaul-api/app.js — static '/uploads' mount & optional legacy fallback
const express = require('express')
const path = require('path')
const cookieParser = require('cookie-parser')
const morgan = require('morgan')
const session = require('express-session')
const passport = require('passport')
require('dotenv').config()
const cors = require('cors')
const fs = require('fs')
const { swaggerUi, swaggerSpec } = require('./swagger')
// Routers
const indexRouter = require('./routes/index')
const authRouter = require('./routes/auth')
const itemRouter = require('./routes/item')
const orderRouter = require('./routes/order')
const tokenRouter = require('./routes/token')
const reviewRouter = require('./routes/review')
const cartRouter = require('./routes/cart')
const petRouter = require('./routes/pet')
const likeRouter = require('./routes/like')
const contentRouter = require('./routes/content')
const qnaRouter = require('./routes/qna')
const exchangeReturnRouter = require('./routes/exchangeReturn')
const { sequelize } = require('./models')
const passportConfig = require('./passport')

const app = express()
passportConfig()

// If behind a proxy (nginx/render/heroku), uncomment:
app.set('trust proxy', 1)

// Port
app.set('port', process.env.PORT || 8002)

// DB 연결 테스트 및 동기화
async function connectDB() {
   try {
      // 먼저 연결 테스트
      await sequelize.authenticate()
      console.log('✅ 데이터베이스 연결 성공')
      await sequelize.sync({ force: false, alter: false })
      console.log('✅ 데이터베이스 동기화 완료')
   } catch (err) {
      console.error('❌ 데이터베이스 연결 실패')
      if (err.original) {
         console.error('원본 에러:', err.original.message)
         console.error('에러 코드:', err.original.code)
      } else {
         console.error('에러 메시지:', err.message)
      }
      console.error('전체 에러:', err)
      process.exit(1) // 서버 시작 실패 시 종료
   }
}

connectDB()

// Middleware
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
app.use(
   cors({
      origin: process.env.FRONTEND_APP_URL, // e.g. http://localhost:5173
      credentials: true,
   })
)
app.use(morgan('dev'))

// Static uploads: serve exactly at "/uploads"
const uploadsDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
app.use(
   '/uploads',
   express.static(uploadsDir, {
      fallthrough: false, // not found => 404 immediately
      // maxAge: '7d', // enable if you want caching
   })
)

// (Optional) Legacy fallback for old absolute file links like "/hero_*.jpg"
// If you don't need this, feel free to delete this handler.
app.get(/^\/(?:[^\/]+\.(?:png|jpe?g|webp|gif|svg))$/i, (req, res, next) => {
   const filename = path.basename(decodeURIComponent(req.path.slice(1)))
   const abs = path.join(uploadsDir, filename)
   fs.access(abs, fs.constants.R_OK, (err) => (err ? next() : res.sendFile(abs)))
})

app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser(process.env.COOKIE_SECRET))

// Session
const sessionMiddleware = session({
   resave: false,
   saveUninitialized: false,
   secret: process.env.COOKIE_SECRET,
   cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24, // 1 day
   },
})
app.use(sessionMiddleware)

// Passport
app.use(passport.initialize())
app.use(passport.session())

// Routers
app.use('/', indexRouter)
app.use('/auth', authRouter)
app.use('/item', itemRouter)
app.use('/order', orderRouter)
app.use('/token', tokenRouter)
app.use('/review', reviewRouter)
app.use('/cart', cartRouter)
app.use('/pets', petRouter)
app.use('/like', likeRouter)
app.use('/contents', contentRouter)
app.use('/qna', qnaRouter)
app.use('/exchange-return', exchangeReturnRouter)

// 404 handler
app.use((req, res, next) => {
   const error = new Error(`${req.method} ${req.url} 라우터가 없습니다.`)
   error.status = 404
   next(error)
})

// Error handler
app.use((err, req, res, next) => {
   const statusCode = err.status || 500
   const errorMessage = err.message || '서버 내부 오류'
   if (process.env.NODE_ENV === 'development') {
   }
   res.status(statusCode).json({ success: false, message: errorMessage, error: err })
})

app.listen(app.get('port'), () => {
})
