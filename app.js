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

// 서버 시작 시 Google OAuth 환경 변수 확인 및 로그
console.log('🔍 Google OAuth 환경 변수 확인:', {
   hasGOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
   GOOGLE_CLIENT_ID_length: process.env.GOOGLE_CLIENT_ID?.length || 0,
   GOOGLE_CLIENT_ID_prefix: process.env.GOOGLE_CLIENT_ID?.substring(0, 15) || '없음',
   hasGOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
   GOOGLE_CLIENT_SECRET_length: process.env.GOOGLE_CLIENT_SECRET?.length || 0,
   NODE_ENV: process.env.NODE_ENV,
   hasGOOGLE_CALLBACK_URL: !!process.env.GOOGLE_CALLBACK_URL,
   GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
   hasAPI_URL: !!process.env.API_URL,
   API_URL: process.env.API_URL,
   expectedCallbackURL: process.env.GOOGLE_CALLBACK_URL || 
      (process.env.NODE_ENV === 'production' 
         ? `${process.env.API_URL || 'https://pethaul-api.onrender.com'}/auth/google/callback`
         : `http://localhost:${process.env.PORT || 8002}/auth/google/callback`),
})

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
   console.warn('⚠️ Google OAuth 환경 변수가 설정되지 않았습니다. Google 로그인을 사용할 수 없습니다.')
} else {
   console.log('✅ Google OAuth 환경 변수 설정 완료')
}

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

// 이미지 파일에 대한 CORS 및 CORB 차단 방지 헤더 추가 미들웨어
app.use('/uploads', (req, res, next) => {
   // CORS 헤더 설정 (이미지 파일도 ORB/CORB 차단 방지)
   const origin = req.headers.origin
   if (origin) {
      const allowedOrigins = process.env.FRONTEND_APP_URL
         ? process.env.FRONTEND_APP_URL.split(',').map((url) => url.trim())
         : ['http://localhost:5173', 'https://pethaul-frontend.onrender.com']
      
      if (allowedOrigins.includes(origin) || origin.includes('onrender.com') || process.env.NODE_ENV === 'development') {
         res.setHeader('Access-Control-Allow-Origin', origin)
         res.setHeader('Access-Control-Allow-Credentials', 'true')
      }
   } else {
      // origin이 없어도 기본 CORS 헤더 설정
      res.setHeader('Access-Control-Allow-Origin', '*')
   }
   
   // ORB/CORB 차단 방지를 위한 헤더
   res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
   res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none')
   
   // CORB 차단 방지: 브라우저가 MIME 타입을 올바르게 인식하도록
   res.setHeader('X-Content-Type-Options', 'nosniff')
   
   next()
})

app.use(
   '/uploads',
   express.static(uploadsDir, {
      fallthrough: false, // not found => 404 immediately
      setHeaders: (res, filePath) => {
         // MIME 타입 명시적 설정 (ORB/CORB 차단 방지)
         const ext = path.extname(filePath).toLowerCase()
         const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
         }
         
         // 확장자에 맞는 MIME 타입 설정
         if (mimeTypes[ext]) {
            res.setHeader('Content-Type', mimeTypes[ext])
         } else {
            // 확장자가 없거나 알 수 없는 경우 기본값
            res.setHeader('Content-Type', 'application/octet-stream')
         }
         
         // CORB 차단 방지: 브라우저가 MIME 타입 스니핑을 하지 않도록
         res.setHeader('X-Content-Type-Options', 'nosniff')
         
         // 캐시 헤더 (선택사항)
         // res.setHeader('Cache-Control', 'public, max-age=31536000')
      },
      // maxAge: '7d', // enable if you want caching
   })
)

// Legacy fallback: 루트 경로로 요청된 이미지를 /uploads로 리다이렉트
// 예: /KakaoTalk_Photo_2024-12-10-18-32-23%200131763214621170.jpeg -> /uploads/KakaoTalk_Photo_2024-12-10-18-32-23%200131763214621170.jpeg
// 라우터보다 먼저 실행되도록 위치 중요
app.get(/^\/([^\/?]+\.(?:png|jpe?g|webp|gif|svg))$/i, (req, res, next) => {
   try {
      // URL 디코딩된 파일명 가져오기
      const encodedFilename = req.params[0]
      const decodedFilename = decodeURIComponent(encodedFilename)
      
      // 파일 경로 확인
      const abs = path.join(uploadsDir, decodedFilename)
      
      fs.access(abs, fs.constants.R_OK, (err) => {
         if (err) {
            // 파일이 없으면 다음 미들웨어로
            console.log('⚠️ 레거시 이미지 파일 없음:', decodedFilename)
            return next()
         }
         
         // 파일이 있으면 /uploads 경로로 리다이렉트
         // 원본 인코딩된 파일명 사용 (공백 등이 %20으로 인코딩된 경우)
         const redirectPath = `/uploads/${encodedFilename}`
         console.log('✅ 레거시 이미지 리다이렉트:', req.path, '->', redirectPath)
         res.redirect(redirectPath)
      })
   } catch (error) {
      // 디코딩 실패 시 다음 미들웨어로
      console.warn('⚠️ 레거시 이미지 디코딩 실패:', req.path, error.message)
      next()
   }
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
