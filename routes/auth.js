// routes/auth.js
const express = require('express')
const crypto = require('crypto')
const bcrypt = require('bcrypt')
const passport = require('passport')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { User } = require('../models')
const { isLoggedIn, isNotLoggedIn, authenticateToken, isAdmin } = require('./middlewares')

const router = express.Router()

// uploads 폴더 준비
try {
   fs.readdirSync('uploads')
} catch (error) {
   fs.mkdirSync('uploads', { recursive: true })
}

// multer 설정 (프로필 이미지 업로드용)
const upload = multer({
   storage: multer.diskStorage({
      destination(req, file, cb) {
         cb(null, 'uploads/')
      },
      filename(req, file, cb) {
         const decoded = decodeURIComponent(file.originalname)
         const ext = path.extname(decoded)
         const basename = path.basename(decoded, ext)
         const safeBase = basename.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]+/g, '') || 'profile'
         cb(null, `profile-${Date.now()}-${safeBase}${ext}`)
      },
   }),
   limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
})

function getBaseUrl(req) {
   if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '')
   const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http'
   const host = req.get('host')
   return `${proto}://${host}`
}

const normalizePhoneDigits = (value) => {
   if (typeof value !== 'string') return null
   const digits = value.replace(/\D/g, '')
   return digits.length ? digits : null
}

const normalizeString = (value) => {
   if (typeof value !== 'string') return null
   const trimmed = value.trim()
   return trimmed.length ? trimmed : null
}

// 회원가입
router.post('/join', isNotLoggedIn, async (req, res, next) => {
   const {
      email,
      password,
      name,
      userId,
      address,
      addressDetail,
      gender,
      phoneNumber,
      defaultDeliveryName,
      defaultDeliveryPhone,
      defaultDeliveryAddress,
      defaultDeliveryRequest,
      defaultDeliveryAddressDetail,
   } = req.body

   try {
      const normalizedPhoneNumber = normalizePhoneDigits(phoneNumber)
      const normalizedDefaultPhone = normalizePhoneDigits(defaultDeliveryPhone)

      // 이메일 중복 확인
      const exUser = await User.findOne({ where: { email } })
      if (exUser) {
         const err = new Error('이미 가입된 이메일입니다.')
         err.status = 409
         return next(err)
      }

      // 전화번호가 온 경우에만 중복 확인 (null 허용)
      if (normalizedPhoneNumber) {
         const exPhone = await User.findOne({ where: { phoneNumber: normalizedPhoneNumber } })
         if (exPhone) {
            const err = new Error('이미 사용 중인 전화번호입니다.')
            err.status = 409
            return next(err)
         }
      }

      // 비밀번호 암호화 (구글 등 소셜계정은 password가 없을 수 있음)
      const hashed = password ? await bcrypt.hash(password, 12) : null

      await User.create({
         userId,
         email,
         password: hashed,
         name,
         address: normalizeString(address),
         addressDetail: normalizeString(addressDetail),
         gender,
         phoneNumber: normalizedPhoneNumber,
         defaultDeliveryName: normalizeString(defaultDeliveryName),
         defaultDeliveryPhone: normalizedDefaultPhone,
         defaultDeliveryAddress: normalizeString(defaultDeliveryAddress),
         defaultDeliveryRequest: normalizeString(defaultDeliveryRequest),
         defaultDeliveryAddressDetail: normalizeString(defaultDeliveryAddressDetail),
      })

      return res.status(201).json({ success: true, message: '회원가입 성공' })
   } catch (err) {
      return next(err)
   }
})

// 아이디 중복 확인
router.post('/check-username', async (req, res, next) => {
   const { userId } = req.body
   try {
      const existingUser = await User.findOne({ where: { userId } })
      if (existingUser) {
         const err = new Error('이미 사용 중인 아이디입니다.')
         err.status = 409
         return next(err)
      }
      return res.status(200).json({ success: true, message: '사용 가능한 아이디입니다.' })
   } catch (err) {
      return next(err)
   }
})

// 이메일 중복 확인
router.post('/check-email', async (req, res, next) => {
   try {
      const { email } = req.body
      const user = await User.findOne({ where: { email } })
      if (user) {
         const error = new Error('이미 사용 중인 이메일입니다.')
         error.status = 409
         return next(error)
      }
      return res.status(200).json({ success: true, message: '사용 가능한 이메일입니다.' })
   } catch (error) {
      return next(error)
   }
})

// 로그인
router.post('/login', isNotLoggedIn, (req, res, next) => {
   passport.authenticate('local', (authError, user, info) => {
      if (authError) return next(authError)
      if (!user) {
         const err = new Error(info?.message || '인증 실패')
         err.status = 401
         return next(err)
      }

      req.login(user, async (loginError) => {
         if (loginError) {
            return next(loginError)
         }

         //임시 비밀번호 만료 확인
         if (user.tempPasswordExpiresAt && new Date() > user.tempPasswordExpiresAt) {
            // DB에서 임시 비밀번호 만료 처리
            await User.update(
               {
                  tempPasswordExpiresAt: null,
                  password: null,
               },
               { where: { id: user.id } }
            )

            return res.status(401).json({
               message: '임시 비밀번호가 만료되었습니다. 다시 비밀번호 찾기를 진행해주세요.',
            })
         }

         // 로그인 성공 후 JWT 토큰 자동 발급
         let token = null
         try {
            // 1. JWT_SECRET 확인
            if (!process.env.JWT_SECRET) {
               console.warn('⚠️ 토큰 자동 발급 실패: JWT_SECRET 환경변수가 설정되지 않았습니다.')
               // JWT_SECRET이 없으면 토큰 발급 불가능
            } else if (!user || !user.id) {
               console.warn('⚠️ 토큰 자동 발급 실패: user 또는 user.id가 없습니다.', { user: user ? { id: user.id } : null })
            } else {
               const jwt = require('jsonwebtoken')
               const { Domain } = require('../models')
               const origin = req.get('origin') || req.headers.host || 'unknown'
               
               // 2. JWT 토큰 생성
               try {
                  token = jwt.sign({ id: user.id, email: user.email || '' }, process.env.JWT_SECRET, { expiresIn: '365d', issuer: 'pethaul' })
                  console.log('✅ JWT 토큰 생성 성공:', { userId: user.id, origin })
               } catch (jwtError) {
                  console.error('❌ JWT 토큰 생성 실패:', jwtError.message)
                  throw jwtError
               }
               
               // 3. DB에 토큰 저장
               try {
                  const [row, created] = await Domain.findOrCreate({
                     where: { userId: user.id, host: origin },
                     defaults: { clientToken: token },
                  })
                  if (!created) {
                     row.clientToken = token
                     await row.save()
                  }
                  console.log('✅ 토큰 DB 저장 성공:', { userId: user.id, origin, created })
               } catch (dbError) {
                  console.error('❌ 토큰 DB 저장 실패:', dbError.message)
                  console.error('DB 오류 상세:', {
                     userId: user.id,
                     origin,
                     error: dbError.name,
                     message: dbError.message,
                  })
                  // DB 저장 실패해도 토큰은 생성되었으므로 반환 가능
               }
            }
         } catch (tokenError) {
            // 토큰 발급 실패해도 로그인은 성공으로 처리
            console.error('❌ 토큰 자동 발급 실패:', {
               message: tokenError.message,
               stack: tokenError.stack,
               userId: user?.id,
               hasJWTSecret: !!process.env.JWT_SECRET,
            })
         }

         return res.status(200).json({
            success: true,
            message: '로그인 성공',
            user: {
               id: user.id,
               userId: user.userId,
               email: user.email,
               name: user.name,
               role: user.role,
               provider: user.provider,
               phoneNumber: user.phoneNumber, // ✅ 추가
               address: user.address,
            addressDetail: user.addressDetail,
               defaultDeliveryName: user.defaultDeliveryName,
               defaultDeliveryPhone: user.defaultDeliveryPhone,
               defaultDeliveryAddress: user.defaultDeliveryAddress,
               defaultDeliveryRequest: user.defaultDeliveryRequest,
            defaultDeliveryAddressDetail: user.defaultDeliveryAddressDetail,
            },
            token: token, // 토큰이 있으면 함께 반환
         })
      })
   })(req, res, next)
})

// 로그아웃
router.post('/logout', isLoggedIn, (req, res, next) => {
   req.logout((err) => {
      if (err) return next(err)

      req.session.destroy(() => {
         res.clearCookie('connect.sid')
         return res.status(200).json({ success: true, message: '로그아웃 성공' })
      })
   })
})

// 로그인 상태 확인
router.get('/check', (req, res) => {
   if (req.isAuthenticated()) {
      return res.status(200).json({
         isAuthenticated: true,
         user: {
            id: req.user.id,
            userId: req.user.userId,
            email: req.user.email,
            name: req.user.name,
            role: req.user.role,
            provider: req.user.provider,
            phoneNumber: req.user.phoneNumber, // ✅ 추가
            address: req.user.address,
            addressDetail: req.user.addressDetail,
            defaultDeliveryName: req.user.defaultDeliveryName,
            defaultDeliveryPhone: req.user.defaultDeliveryPhone,
            defaultDeliveryAddress: req.user.defaultDeliveryAddress,
            defaultDeliveryRequest: req.user.defaultDeliveryRequest,
            defaultDeliveryAddressDetail: req.user.defaultDeliveryAddressDetail,
         },
      })
   }
   return res.status(200).json({ isAuthenticated: false })
})

// ✅ 구글 로그인 시작
router.get('/google', (req, res, next) => {
   console.log('🔍 Google OAuth 시작 요청:', {
      timestamp: new Date().toISOString(),
      headers: {
         origin: req.headers.origin,
         referer: req.headers.referer,
         userAgent: req.headers['user-agent'],
      },
      hasGoogleStrategy: !!passport._strategies?.google,
   })
   
   // Google Strategy가 등록되어 있는지 확인
   if (!passport._strategies?.google) {
      console.error('❌ Google OAuth Strategy가 등록되지 않았습니다.')
      const isDevelopment = process.env.NODE_ENV !== 'production'
      const clientUrl = isDevelopment
         ? (process.env.CLIENT_URL || process.env.FRONTEND_APP_URL || 'http://localhost:5173')
         : (process.env.CLIENT_URL || process.env.FRONTEND_APP_URL || 'https://pethaul-frontend.onrender.com')
      return res.redirect(`${clientUrl}/login?error=google_strategy_not_found`)
   }
   
   passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next)
})

// ✅ 구글 로그인 콜백 처리
router.get(
   '/google/callback',
   (req, res, next) => {
      console.log('🔍 Google OAuth 콜백 시작:', {
         query: req.query,
         hasCode: !!req.query.code,
         hasError: !!req.query.error,
         error: req.query.error,
         errorDescription: req.query.error_description,
         code: req.query.code ? `${req.query.code.substring(0, 20)}...` : null,
      })
      
      // Google에서 에러를 반환한 경우
      if (req.query.error) {
         console.error('❌ Google OAuth 에러 응답:', {
            error: req.query.error,
            errorDescription: req.query.error_description,
            errorUri: req.query.error_uri,
         })
         
         // 특정 에러에 대한 재시도 로직
         if (req.query.error === 'access_denied') {
            // 사용자가 권한을 거부한 경우
            const isDevelopment = process.env.NODE_ENV !== 'production'
            const clientUrl = isDevelopment
               ? (process.env.CLIENT_URL || process.env.FRONTEND_APP_URL || 'http://localhost:5173')
               : (process.env.CLIENT_URL || process.env.FRONTEND_APP_URL || 'https://pethaul-frontend.onrender.com')
            return res.redirect(`${clientUrl}/login?error=access_denied`)
         }
      }
      
      // code가 없으면 에러
      if (!req.query.code) {
         console.error('❌ Google OAuth code 없음:', { query: req.query })
         const isDevelopment = process.env.NODE_ENV !== 'production'
         const clientUrl = isDevelopment
            ? (process.env.CLIENT_URL || process.env.FRONTEND_APP_URL || 'http://localhost:5173')
            : (process.env.CLIENT_URL || process.env.FRONTEND_APP_URL || 'https://pethaul-frontend.onrender.com')
         return res.redirect(`${clientUrl}/login?error=google_auth_failed`)
      }
      
      passport.authenticate('google', (err, user, info) => {
         console.log('🔍 passport.authenticate 콜백:', {
            hasError: !!err,
            errorMessage: err?.message,
            errorCode: err?.code,
            hasUser: !!user,
            userType: user ? typeof user : null,
            userId: user?.id,
            userEmail: user?.email,
            hasInfo: !!info,
            info: info,
            infoType: typeof info,
            infoKeys: info ? Object.keys(info) : null,
            infoMessage: info?.message,
         })
         
         if (err) {
            console.error('❌ Google OAuth 인증 오류 상세:', {
               message: err.message,
               stack: err.stack,
               name: err.name,
               code: err.code,
               statusCode: err.statusCode,
               info: info,
               // Google OAuth 특정 에러 코드 확인
               isRedirectUriMismatch: err.message?.includes('redirect_uri_mismatch') || err.message?.includes('redirect_uri'),
               isInvalidClient: err.message?.includes('invalid_client'),
               isInvalidGrant: err.message?.includes('invalid_grant'),
            })
            
            // redirect_uri_mismatch 에러인 경우 상세 로그
            if (err.message?.includes('redirect_uri_mismatch') || err.message?.includes('redirect_uri')) {
               console.error('❌ Redirect URI 불일치 오류:', {
                  expectedCallbackURL: process.env.GOOGLE_CALLBACK_URL || (process.env.NODE_ENV === 'production' 
                     ? `${process.env.API_URL || 'https://pethaul-api.onrender.com'}/auth/google/callback`
                     : `http://localhost:${process.env.PORT || 8002}/auth/google/callback`),
                  message: 'Google Cloud Console의 Authorized redirect URIs에 위 URL이 정확히 일치하는지 확인하세요.',
               })
            }
            
            const isDevelopment = process.env.NODE_ENV !== 'production'
            const clientUrl = isDevelopment
               ? (process.env.CLIENT_URL || process.env.FRONTEND_APP_URL || 'http://localhost:5173')
               : (process.env.CLIENT_URL || process.env.FRONTEND_APP_URL || 'https://pethaul-frontend.onrender.com')
            return res.redirect(`${clientUrl}/login?error=google_auth_failed`)
         }
         
         if (!user) {
            console.error('❌ Google OAuth 인증 실패: 사용자 정보 없음', {
               info: info,
               hasInfo: !!info,
               infoType: typeof info,
               infoKeys: info ? Object.keys(info) : null,
               infoMessage: info?.message,
               infoCode: info?.code,
               infoString: info ? JSON.stringify(info, null, 2) : null,
            })
            
            // info에 에러 정보가 있는 경우
            if (info && typeof info === 'object') {
               console.error('❌ Google OAuth info 오류 상세:', {
                  message: info.message,
                  code: info.code,
                  statusCode: info.statusCode,
                  allKeys: Object.keys(info),
                  fullInfo: JSON.stringify(info, null, 2),
               })
               
               // 특정 에러 코드에 대한 처리
               if (info.code === 'EAUTH' || info.message?.includes('redirect_uri_mismatch')) {
                  console.error('❌ Redirect URI 불일치 감지:', {
                     expectedCallbackURL: process.env.GOOGLE_CALLBACK_URL || (process.env.NODE_ENV === 'production' 
                        ? `${process.env.API_URL || 'https://pethaul-api.onrender.com'}/auth/google/callback`
                        : `http://localhost:${process.env.PORT || 8002}/auth/google/callback`),
                     message: 'Google Cloud Console의 Authorized redirect URIs에 위 URL이 정확히 일치하는지 확인하세요.',
                  })
               }
            }
            
            // 에러 원인을 URL 파라미터로 전달 (디버깅용)
            let errorParam = 'google_auth_failed'
            if (info?.code === 'EAUTH' || info?.message?.includes('redirect_uri')) {
               errorParam = 'google_auth_failed:redirect_uri_mismatch'
            } else if (info?.message?.includes('invalid_client')) {
               errorParam = 'google_auth_failed:invalid_client'
            } else if (info?.message?.includes('invalid_grant')) {
               errorParam = 'google_auth_failed:invalid_grant'
            }
            
            const isDevelopment = process.env.NODE_ENV !== 'production'
            const clientUrl = isDevelopment
               ? (process.env.CLIENT_URL || process.env.FRONTEND_APP_URL || 'http://localhost:5173')
               : (process.env.CLIENT_URL || process.env.FRONTEND_APP_URL || 'https://pethaul-frontend.onrender.com')
            return res.redirect(`${clientUrl}/login?error=${errorParam}`)
         }
         
         console.log('✅ Google OAuth 인증 성공, 세션 로그인 시도:', { userId: user.id, email: user.email })
         
         // 로그인 성공
         req.logIn(user, { session: true }, (loginErr) => {
            if (loginErr) {
               console.error('❌ 세션 로그인 오류:', {
                  message: loginErr.message,
                  stack: loginErr.stack,
                  name: loginErr.name,
               })
               
               // 세션 로그인 실패 시에도 재시도
               console.log('🔄 세션 로그인 재시도...')
               setTimeout(() => {
                  req.logIn(user, { session: true }, (retryErr) => {
                     if (retryErr) {
                        console.error('❌ 세션 로그인 재시도 실패:', retryErr.message)
                        const isDevelopment = process.env.NODE_ENV !== 'production'
                        const clientUrl = isDevelopment
                           ? (process.env.CLIENT_URL || process.env.FRONTEND_APP_URL || 'http://localhost:5173')
                           : (process.env.CLIENT_URL || process.env.FRONTEND_APP_URL || 'https://pethaul-frontend.onrender.com')
                        return res.redirect(`${clientUrl}/login?error=session_failed`)
                     }
                     console.log('✅ 세션 로그인 재시도 성공')
                     next()
                  })
               }, 200)
               return
            }
            
            console.log('✅ 세션 로그인 성공:', {
               isAuthenticated: req.isAuthenticated(),
               hasUser: !!req.user,
               userId: req.user?.id,
            })
            
            // req.user가 아직 설정되지 않았을 수 있으므로 재시도
            if (!req.user) {
               console.log('⚠️ req.user 없음, 대기 후 재시도...')
               let retryCount = 0
               const checkUser = setInterval(() => {
                  retryCount++
                  if (req.user || retryCount >= 5) {
                     clearInterval(checkUser)
                     if (req.user) {
                        console.log('✅ req.user 복원 성공:', { userId: req.user.id })
                     } else {
                        console.warn('⚠️ req.user 복원 실패, 계속 진행')
                     }
                     next()
                  }
               }, 200)
            } else {
               next()
            }
         })
      })(req, res, next)
   },
   async (req, res) => {
      try {
         console.log('🔍 Google OAuth 콜백 핸들러 시작:', {
            isAuthenticated: req.isAuthenticated(),
            hasUser: !!req.user,
            userId: req.user?.id,
            userEmail: req.user?.email,
         })
         
         // req.user가 없으면 세션이 아직 설정되지 않았을 수 있음 - 대기
         if (!req.user) {
            console.warn('⚠️ req.user가 없음, 세션 설정 대기 중...')
            for (let attempt = 0; attempt < 5; attempt++) {
               await new Promise(resolve => setTimeout(resolve, 200))
               if (req.user) {
                  console.log('✅ req.user 복원 성공:', { userId: req.user.id })
                  break
               }
            }
            
            if (!req.user) {
               console.error('❌ req.user 복원 실패')
               const isDevelopment = process.env.NODE_ENV !== 'production'
               const clientUrl = isDevelopment
                  ? (process.env.CLIENT_URL || process.env.FRONTEND_APP_URL || 'http://localhost:5173')
                  : (process.env.CLIENT_URL || process.env.FRONTEND_APP_URL || 'https://pethaul-frontend.onrender.com')
               return res.redirect(`${clientUrl}/login?error=session_failed`)
            }
         }
         
         // 구글 로그인 성공 후 JWT 토큰 자동 발급
         let token = null
         try {
            // 1. req.user 확인
            if (!req.user) {
               console.warn('⚠️ 구글 로그인 토큰 발급 실패: req.user가 없습니다.')
            } else if (!req.user.id) {
               console.warn('⚠️ 구글 로그인 토큰 발급 실패: req.user.id가 없습니다.', { user: req.user })
            } else if (!process.env.JWT_SECRET) {
               console.warn('⚠️ 구글 로그인 토큰 발급 실패: JWT_SECRET 환경변수가 설정되지 않았습니다.')
            } else {
               const jwt = require('jsonwebtoken')
               const { Domain } = require('../models')
               const origin = req.get('origin') || req.headers.host || 'unknown'
               
               // 2. JWT 토큰 생성
               try {
                  token = jwt.sign({ id: req.user.id, email: req.user.email || '' }, process.env.JWT_SECRET, { expiresIn: '365d', issuer: 'pethaul' })
                  console.log('✅ 구글 로그인 JWT 토큰 생성 성공:', { userId: req.user.id, origin })
               } catch (jwtError) {
                  console.error('❌ 구글 로그인 JWT 토큰 생성 실패:', jwtError.message)
                  throw jwtError
               }
               
               // 3. DB에 토큰 저장
               try {
                  const [row, created] = await Domain.findOrCreate({
                     where: { userId: req.user.id, host: origin },
                     defaults: { clientToken: token },
                  })
                  if (!created) {
                     row.clientToken = token
                     await row.save()
                  }
                  console.log('✅ 구글 로그인 토큰 DB 저장 성공:', { userId: req.user.id, origin, created })
               } catch (dbError) {
                  console.error('❌ 구글 로그인 토큰 DB 저장 실패:', dbError.message)
                  console.error('DB 오류 상세:', {
                     userId: req.user.id,
                     origin,
                     error: dbError.name,
                     message: dbError.message,
                  })
                  // DB 저장 실패해도 토큰은 생성되었으므로 반환 가능
               }
            }
         } catch (tokenError) {
            // 토큰 발급 실패해도 로그인은 성공으로 처리
            console.error('❌ 구글 로그인 토큰 자동 발급 실패:', {
               message: tokenError.message,
               stack: tokenError.stack,
               userId: req.user?.id,
               hasJWTSecret: !!process.env.JWT_SECRET,
            })
         }

         // 개발 환경과 프로덕션 환경 구분
         const isDevelopment = process.env.NODE_ENV !== 'production'
         let clientUrl
         
         if (isDevelopment) {
            // 개발 환경: localhost 사용
            clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_APP_URL || 'http://localhost:5173'
         } else {
            // 프로덕션: 환경 변수 필수, 없으면 기본값 사용
            clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_APP_URL
            if (!clientUrl) {
               console.warn('⚠️ 프로덕션 환경에서 CLIENT_URL 또는 FRONTEND_APP_URL이 설정되지 않았습니다. 기본값 사용.')
               clientUrl = 'https://pethaul-frontend.onrender.com'
            }
         }
         
         // 토큰이 있으면 URL 파라미터로 전달
         const redirectUrl = token 
            ? `${clientUrl}/google-success?token=${encodeURIComponent(token)}`
            : `${clientUrl}/google-success`
         
         console.log('✅ 구글 로그인 성공, 리다이렉트:', redirectUrl, { 
            isDevelopment, 
            hasToken: !!token, 
            userId: req.user?.id,
            clientUrl,
            envVars: {
               CLIENT_URL: process.env.CLIENT_URL || '미설정',
               FRONTEND_APP_URL: process.env.FRONTEND_APP_URL || '미설정',
               NODE_ENV: process.env.NODE_ENV || '미설정'
            }
         })
      // 로그인 성공 시 프론트로 리다이렉트
         return res.redirect(redirectUrl)
      } catch (error) {
         console.error('구글 로그인 콜백 오류:', error)
         // 에러 발생 시에도 리다이렉트 (로그인은 성공했을 수 있음)
         const isDevelopment = process.env.NODE_ENV !== 'production'
         let clientUrl
         
         if (isDevelopment) {
            clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_APP_URL || 'http://localhost:5173'
         } else {
            clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_APP_URL
            if (!clientUrl) {
               console.warn('⚠️ 프로덕션 환경에서 CLIENT_URL 또는 FRONTEND_APP_URL이 설정되지 않았습니다. 기본값 사용.')
               clientUrl = 'https://pethaul-frontend.onrender.com'
            }
         }
         
         console.log('⚠️ 구글 로그인 콜백 오류 후 리다이렉트:', `${clientUrl}/google-success`, { isDevelopment, clientUrl })
         return res.redirect(`${clientUrl}/google-success`)
      }
   }
)

// ✅ 구글 로그인 상태 체크
router.get('/googlecheck', (req, res) => {
   if (req.isAuthenticated() && req.user.provider === 'google') {
      return res.status(200).json({
         googleAuthenticated: true,
         user: {
            id: req.user.id,
            userId: req.user.userId,
            email: req.user.email,
            name: req.user.name,
            role: req.user.role,
            provider: req.user.provider,
            phoneNumber: req.user.phoneNumber,
         },
      })
   }
   return res.status(200).json({ googleAuthenticated: false })
})

// 핸드폰 번호로 id 찾기
router.post('/findid', isNotLoggedIn, async (req, res, next) => {
   try {
      const { phoneNumber } = req.body
      const users = await User.findAll({ where: { phoneNumber } })

      if (!users.length) {
         return res.status(404).json({
            message: '입력하신 정보와 일치하는 회원이 존재하지 않습니다.',
         })
      }

      res.status(200).json({
         message: 'ID 조회에 성공했습니다.',
         ids: users.map((user) => user.userId),
      })
   } catch (error) {
      next(error)
   }
})

// 비밀번호 분실 시 임시비밀번호 발급
router.post('/updatepw', isNotLoggedIn, async (req, res, next) => {
   try {
      const { userId, phoneNumber } = req.body
      const user = await User.findOne({ where: { userId, phoneNumber } })
      if (!user) {
         return res.status(404).json({ message: '입력하신 정보와 일치하는 회원이 존재하지 않습니다.' })
      }

      //임시 비밀번호 생성 및 해싱
      const tempPassword = crypto.randomBytes(6).toString('hex')
      const hash = await bcrypt.hash(tempPassword, 10)

      await user.update({
         password: hash,
         tempPasswordExpiresAt: new Date(Date.now() + 30 * 60 * 1000), // 유효시간 30분
      })
      res.status(200).json({
         message: '임시 비밀번호가 발급되었습니다.',
         tempPassword,
      })
   } catch (error) {
      next(error)
   }
})

//회원 정보 수정
router.put('/', isLoggedIn, async (req, res, next) => {
   try {
      const {
         name,
         email,
         phoneNumber,
         address,
      addressDetail,
         newPassword,
         defaultDeliveryName,
         defaultDeliveryPhone,
         defaultDeliveryAddress,
         defaultDeliveryRequest,
      defaultDeliveryAddressDetail,
      } = req.body
      const user = await User.findByPk(req.user.id)
      if (!user) {
         return res.status(404).json({ message: '회원 정보를 찾을 수 없습니다.' })
      }

      user.name = name
      user.email = email
      if (phoneNumber !== undefined) {
         user.phoneNumber = normalizePhoneDigits(phoneNumber)
      }
      if (address !== undefined) user.address = normalizeString(address)
      if (addressDetail !== undefined) user.addressDetail = normalizeString(addressDetail)

      if (defaultDeliveryName !== undefined) {
         user.defaultDeliveryName = normalizeString(defaultDeliveryName)
      }
      if (defaultDeliveryPhone !== undefined) {
         user.defaultDeliveryPhone = normalizePhoneDigits(defaultDeliveryPhone)
      }
      if (defaultDeliveryAddress !== undefined) {
         user.defaultDeliveryAddress = normalizeString(defaultDeliveryAddress)
      }
      if (defaultDeliveryRequest !== undefined) {
         user.defaultDeliveryRequest = normalizeString(defaultDeliveryRequest)
      }
      if (defaultDeliveryAddressDetail !== undefined) {
         user.defaultDeliveryAddressDetail = normalizeString(defaultDeliveryAddressDetail)
      }

      if (newPassword) user.password = await bcrypt.hash(newPassword, 12)

      await user.save()
      res.status(200).json({
         message: '회원 정보를 성공적으로 수정했습니다.',
         user: {
            id: req.user.id,
            userId: user.userId,
            name: user.name,
            email: user.email,
            phoneNumber: user.phoneNumber,
            address: user.address,
            addressDetail: user.addressDetail,
            defaultDeliveryName: user.defaultDeliveryName,
            defaultDeliveryPhone: user.defaultDeliveryPhone,
            defaultDeliveryAddress: user.defaultDeliveryAddress,
            defaultDeliveryRequest: user.defaultDeliveryRequest,
            defaultDeliveryAddressDetail: user.defaultDeliveryAddressDetail,
            avatar: user.avatar,
         },
      })
   } catch (error) {
      next(error)
   }
})

// 프로필 이미지 업로드
router.post('/avatar', authenticateToken, upload.single('avatar'), async (req, res, next) => {
   try {
      if (!req.file) {
         return res.status(400).json({ message: '이미지 파일이 필요합니다.' })
      }

      const user = await User.findByPk(req.user.id)
      if (!user) {
         return res.status(404).json({ message: '회원 정보를 찾을 수 없습니다.' })
      }

      const base = getBaseUrl(req)
      const avatarUrl = `${base}/uploads/${encodeURIComponent(req.file.filename)}`
      
      // 기존 아바타가 있으면 삭제 (선택사항)
      if (user.avatar && user.avatar.includes('/uploads/')) {
         const oldFilename = user.avatar.split('/uploads/')[1]
         if (oldFilename) {
            try {
               fs.unlinkSync(path.join(__dirname, '..', 'uploads', decodeURIComponent(oldFilename)))
            } catch (err) {
               // 파일 삭제 실패는 무시
            }
         }
      }

      user.avatar = avatarUrl
      await user.save()

      res.status(200).json({
         message: '프로필 이미지가 업로드되었습니다.',
         avatar: avatarUrl,
      })
   } catch (error) {
      next(error)
   }
})

// 전체 사용자 목록 조회 (관리자 전용)
router.get('/all', authenticateToken, isAdmin, async (req, res, next) => {
   try {
      const { Op } = require('sequelize')
      const page = parseInt(req.query.page, 10) || 1
      const limit = parseInt(req.query.limit, 10) || 20
      const offset = (page - 1) * limit
      const searchTerm = (req.query.searchTerm || '').trim()

      const where = {}
      if (searchTerm) {
         where[Op.or] = [
            { userId: { [Op.like]: `%${searchTerm}%` } },
            { name: { [Op.like]: `%${searchTerm}%` } },
            { email: { [Op.like]: `%${searchTerm}%` } },
         ]
      }

      const { rows, count } = await User.findAndCountAll({
         where,
         attributes: ['id', 'userId', 'name', 'email', 'phoneNumber', 'role', 'provider', 'avatar', 'createdAt'],
         order: [['createdAt', 'DESC']],
         limit,
         offset,
      })

      res.status(200).json({
         users: rows,
         pagination: {
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
         },
      })
   } catch (error) {
      next(error)
   }
})

// 비밀번호 확인
router.post('/verify', authenticateToken, async (req, res, next) => {
   try {
      const user = await User.findByPk(req.user.id)
      const { password } = req.body
      if (!user) {
         return res.status(404).json({ message: '회원 정보를 찾을 수 없습니다.' })
      }

      const isMatch = await bcrypt.compare(password, user.password)
      if (!isMatch) {
         return res.status(401).json({ message: '비밀번호가 일치하지 않습니다.' })
      }

      res.status(200).json({
         message: '비밀번호 확인에 성공했습니다.',
         success: true,
      })
   } catch (error) {
      next(error)
   }
})
module.exports = router
