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
      
      // 환경 변수 확인
      const env = process.env.NODE_ENV || 'development'
      if (env === 'production') {
         console.error('\n📋 프로덕션 환경 변수 확인:')
         console.error('  NODE_ENV:', process.env.NODE_ENV)
         console.error('  DEPLOY_DB_USERNAME:', process.env.DEPLOY_DB_USERNAME ? '✅ 설정됨' : '❌ 미설정')
         console.error('  DEPLOY_DB_PASSWORD:', process.env.DEPLOY_DB_PASSWORD ? '✅ 설정됨' : '❌ 미설정')
         console.error('  DEPLOY_DB_NAME:', process.env.DEPLOY_DB_NAME || '❌ 미설정')
         console.error('  DEPLOY_DB_HOST:', process.env.DEPLOY_DB_HOST || '❌ 미설정')
         console.error('  DEPLOY_DB_DIALECT:', process.env.DEPLOY_DB_DIALECT || 'mysql (기본값)')
      }
      
      if (err.original) {
         console.error('\n🔍 연결 에러 상세:')
         console.error('  원본 에러:', err.original.message)
         console.error('  에러 코드:', err.original.code)
         if (err.original.code === 'ECONNREFUSED') {
            console.error('\n💡 해결 방법:')
            console.error('  1. DEPLOY_DB_HOST가 올바른지 확인하세요')
            console.error('  2. 데이터베이스 서버가 실행 중인지 확인하세요')
            console.error('  3. 방화벽 설정에서 Render IP가 허용되어 있는지 확인하세요')
            console.error('  4. 포트 번호가 포함되어 있는지 확인하세요 (예: hostname:3306)')
         }
      } else {
         console.error('에러 메시지:', err.message)
      }
      
      process.exit(1) // 서버 시작 실패 시 종료
   }
}

connectDB()

// Middleware
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// CORS 설정: 여러 origin 허용 및 환경변수 폴백
const allowedOrigins = process.env.FRONTEND_APP_URL
   ? process.env.FRONTEND_APP_URL.split(',').map((url) => url.trim())
   : ['http://localhost:5173', 'https://pethaul-frontend.onrender.com']

// CORS 미들웨어 설정
const corsOptions = {
   origin: (origin, callback) => {
      // origin이 없으면 (같은 도메인 요청, Postman 등) 허용
      if (!origin) return callback(null, true)
      
      // 허용된 origin인지 확인
      if (allowedOrigins.includes(origin)) {
         callback(null, true)
      } else {
         // 개발 환경에서는 모든 origin 허용 (디버깅용)
         if (process.env.NODE_ENV === 'development') {
            callback(null, true)
         } else {
            // 프로덕션에서는 Render.com 도메인도 허용 (안전장치)
            if (origin.includes('onrender.com')) {
               callback(null, true)
            } else {
               callback(new Error('CORS 정책에 의해 차단되었습니다.'))
            }
         }
      }
   },
   credentials: true,
   methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
   allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
   exposedHeaders: ['Content-Type', 'Authorization'],
   maxAge: 86400, // 24시간
   preflightContinue: false,
   optionsSuccessStatus: 204,
}

app.use(cors(corsOptions))
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
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // OAuth 리다이렉트를 위해 필요
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

// Error handler (CORS 헤더 포함)
app.use((err, req, res, next) => {
   const statusCode = err.status || 500
   const errorMessage = err.message || '서버 내부 오류'
   
   // CORS 헤더 추가 (에러 응답에도 필요) - 항상 추가하여 CORS 오류 방지
   const origin = req.headers.origin
   if (origin) {
      const allowedOrigins = process.env.FRONTEND_APP_URL
         ? process.env.FRONTEND_APP_URL.split(',').map((url) => url.trim())
         : ['http://localhost:5173', 'https://pethaul-frontend.onrender.com']
      
      // Render.com 도메인은 항상 허용
      if (allowedOrigins.includes(origin) || origin.includes('onrender.com') || process.env.NODE_ENV === 'development') {
         res.setHeader('Access-Control-Allow-Origin', origin)
         res.setHeader('Access-Control-Allow-Credentials', 'true')
         res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
         res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
      }
   } else {
      // origin이 없어도 기본 CORS 헤더 설정 (안전장치)
      res.setHeader('Access-Control-Allow-Origin', '*')
   }
   
   // 응답이 이미 전송되었는지 확인
   if (res.headersSent) {
      return next(err)
   }
   
   if (process.env.NODE_ENV === 'development') {
      console.error('에러 상세:', err)
      console.error('에러 스택:', err.stack)
   }
   
   try {
      res.status(statusCode).json({ success: false, message: errorMessage, error: process.env.NODE_ENV === 'development' ? err : undefined })
   } catch (sendError) {
      // 응답 전송 실패 시 로깅만
      console.error('에러 응답 전송 실패:', sendError)
   }
})

// 서버 크래시 방지를 위한 전역 에러 핸들러
process.on('uncaughtException', (error) => {
   console.error('❌ 처리되지 않은 예외:', error)
   console.error('스택:', error.stack)
   // 서버를 종료하지 않고 계속 실행 (프로덕션에서는 서버 재시작 고려)
})

process.on('unhandledRejection', (reason, promise) => {
   console.error('❌ 처리되지 않은 Promise 거부:', reason)
   console.error('Promise:', promise)
   // 서버를 종료하지 않고 계속 실행
})

app.listen(app.get('port'), () => {
   console.log(`✅ 서버가 포트 ${app.get('port')}에서 실행 중입니다.`)
})
