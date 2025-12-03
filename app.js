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
const { User } = require('./models')
const passportConfig = require('./passport')
const bcrypt = require('bcrypt')

const app = express()

// Google OAuth 환경 변수 확인
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
   console.warn('Google OAuth 환경 변수가 설정되지 않았습니다. Google 로그인을 사용할 수 없습니다.')
}

passportConfig()

// If behind a proxy (nginx/render/heroku), uncomment:
app.set('trust proxy', 1)

// Port
app.set('port', process.env.PORT || 8002)

// 관리자 계정 자동 생성 함수
async function ensureAdminAccount() {
   try {
      const adminUserId = process.env.ADMIN_USER_ID || 'admin'
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123!'
      const adminName = process.env.ADMIN_NAME || '관리자'
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@pethaul.com'

      // 기존 관리자 계정 확인
      const existingAdmin = await User.findOne({ where: { userId: adminUserId } })
      
      if (existingAdmin) {
         // 이미 존재하는 경우 role만 업데이트
         if (existingAdmin.role !== 'ADMIN') {
            await existingAdmin.update({ role: 'ADMIN' })
            console.log(`✅ 기존 사용자 '${adminUserId}'의 권한을 관리자로 변경했습니다.`)
         }
         
         // 비밀번호 업데이트 여부 확인
         if (process.env.ADMIN_PASSWORD) {
            const hashedPassword = await bcrypt.hash(adminPassword, 10)
            await existingAdmin.update({ password: hashedPassword })
            console.log(`✅ 관리자 계정 비밀번호를 업데이트했습니다.`)
         }
         
         return
      }

      // 새 관리자 계정 생성
      const hashedPassword = await bcrypt.hash(adminPassword, 10)
      
      await User.create({
         userId: adminUserId,
         name: adminName,
         email: adminEmail,
         password: hashedPassword,
         role: 'ADMIN',
         provider: 'local',
      })

      console.log('✅ 관리자 계정이 자동 생성되었습니다.')
      console.log(`   ID: ${adminUserId}`)
      console.log(`   이메일: ${adminEmail}`)
   } catch (error) {
      console.error('⚠️ 관리자 계정 생성 실패:', error.message)
      // 관리자 계정 생성 실패해도 서버는 계속 실행
   }
}

// DB 연결 테스트 및 동기화
async function connectDB() {
   try {
      // 먼저 연결 테스트
      await sequelize.authenticate()
      console.log('데이터베이스 연결 성공')
      
      // 프로덕션에서는 alter를 사용하지 않음 (Too many keys 에러 방지)
      // 스키마 변경은 마이그레이션 스크립트를 사용하거나 수동으로 처리
      const shouldAlter = process.env.NODE_ENV !== 'production' && process.env.ALLOW_DB_ALTER === 'true'
      await sequelize.sync({ force: false, alter: shouldAlter })
      console.log('데이터베이스 동기화 완료')
      
      // 관리자 계정 확인 및 생성
      await ensureAdminAccount()
   } catch (err) {
      console.error('데이터베이스 연결 실패:', err.message)
      
      if (err.original) {
         console.error('연결 에러:', err.original.message)
         if (err.original.code === 'ECONNREFUSED') {
            console.error('데이터베이스 서버 연결 거부됨. 호스트 및 포트 확인 필요')
         }
      }
      
      process.exit(1)
   }
}

connectDB()

// Middleware
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// CORS 설정: 여러 origin 허용 및 환경변수 폴백
const allowedOrigins = process.env.FRONTEND_APP_URL
   ? process.env.FRONTEND_APP_URL.split(',').map((url) => url.trim())
   : ['http://localhost:5173', 'https://pethaul.vercel.app']

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
            // 프로덕션에서는 Vercel 도메인도 허용 (안전장치)
            if (origin.includes('vercel.app')) {
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
if (!fs.existsSync(uploadsDir)) {
   fs.mkdirSync(uploadsDir, { recursive: true })
}

// 이미지 파일에 대한 CORS 및 CORB 차단 방지 헤더 추가 미들웨어
app.use('/uploads', (req, res, next) => {
   // CORS 헤더 설정 (이미지 파일도 ORB/CORB 차단 방지)
   const origin = req.headers.origin
   if (origin) {
      const allowedOrigins = process.env.FRONTEND_APP_URL
         ? process.env.FRONTEND_APP_URL.split(',').map((url) => url.trim())
         : ['http://localhost:5173', 'https://pethaul.vercel.app']
      
      if (allowedOrigins.includes(origin) || origin.includes('vercel.app') || process.env.NODE_ENV === 'development') {
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

// URL 디코딩된 파일명으로 이미지 서빙
app.use('/uploads', (req, res, next) => {
   const requestedFile = req.path.replace(/^\//, '')
   if (!requestedFile) {
      return next()
   }
   
   // URL 디코딩
   let decodedFile
   try {
      decodedFile = decodeURIComponent(requestedFile)
   } catch (e) {
      decodedFile = requestedFile
   }
   
   // 디코딩된 파일 경로로 파일 찾기
   const filePath = path.join(uploadsDir, decodedFile)
   
   // 파일 존재 확인
   fs.access(filePath, fs.constants.R_OK, (err) => {
      if (err) {
         return next() // 파일이 없으면 다음 미들웨어로 (404 처리)
      }
      
      // 파일이 있으면 직접 서빙
      const ext = path.extname(filePath).toLowerCase()
      const mimeTypes = {
         '.jpg': 'image/jpeg',
         '.jpeg': 'image/jpeg',
         '.png': 'image/png',
         '.gif': 'image/gif',
         '.webp': 'image/webp',
         '.svg': 'image/svg+xml',
      }
      
      if (mimeTypes[ext]) {
         res.setHeader('Content-Type', mimeTypes[ext])
      } else {
         res.setHeader('Content-Type', 'application/octet-stream')
      }
      
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.sendFile(filePath)
   })
})

app.use(
   '/uploads',
   express.static(uploadsDir, {
      fallthrough: true, // 커스텀 미들웨어에서 처리 못한 경우에만 사용
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
app.get(/^\/([^\/?]+\.(?:png|jpe?g|webp|gif|svg))$/i, (req, res, next) => {
   try {
      const encodedFilename = req.params[0]
      const decodedFilename = decodeURIComponent(encodedFilename)
      const abs = path.join(uploadsDir, decodedFilename)
      
      fs.access(abs, fs.constants.R_OK, (err) => {
         if (err) return next()
         res.redirect(`/uploads/${encodedFilename}`)
      })
   } catch (error) {
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

// Error handler
app.use((err, req, res, next) => {
   const statusCode = err.status || 500
   const errorMessage = err.message || '서버 내부 오류'
   
   // CORS 헤더 추가
   const origin = req.headers.origin
   if (origin) {
      const allowedOrigins = process.env.FRONTEND_APP_URL
         ? process.env.FRONTEND_APP_URL.split(',').map((url) => url.trim())
         : ['http://localhost:5173', 'https://pethaul.vercel.app']
      
      if (allowedOrigins.includes(origin) || origin.includes('vercel.app') || process.env.NODE_ENV === 'development') {
         res.setHeader('Access-Control-Allow-Origin', origin)
         res.setHeader('Access-Control-Allow-Credentials', 'true')
         res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
         res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
      }
   } else {
      res.setHeader('Access-Control-Allow-Origin', '*')
   }
   
   if (res.headersSent) {
      return next(err)
   }
   
   if (statusCode >= 500) {
      console.error('서버 오류:', errorMessage)
   }
   
   res.status(statusCode).json({
      success: false,
      message: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { error: err }),
   })
})

// Global error handlers
process.on('uncaughtException', (error) => {
   console.error('처리되지 않은 예외:', error.message)
})

process.on('unhandledRejection', (reason) => {
   console.error('처리되지 않은 Promise 거부:', reason)
})

app.listen(app.get('port'), () => {
   console.log(`서버가 포트 ${app.get('port')}에서 실행 중입니다.`)
})
