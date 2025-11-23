// routes/auth.js
const express = require('express')
const crypto = require('crypto')
const bcrypt = require('bcrypt')
const passport = require('passport')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const https = require('https')
const { URL } = require('url')
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
               } catch (jwtError) {
                  console.error('JWT 토큰 생성 실패:', jwtError.message)
                  throw jwtError
               }
               
               try {
                  const [row, created] = await Domain.findOrCreate({
                     where: { userId: user.id, host: origin },
                     defaults: { clientToken: token },
                  })
                  if (!created) {
                     row.clientToken = token
                     await row.save()
                  }
               } catch (dbError) {
                  console.error('토큰 DB 저장 실패:', dbError.message)
               }
            }
         } catch (tokenError) {
            console.error('토큰 자동 발급 실패:', tokenError.message)
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

// Google 로그인 시작
router.get('/google', (req, res) => {
   try {
      if (!process.env.GOOGLE_CLIENT_ID) {
         const isDevelopment = process.env.NODE_ENV !== 'production'
         const clientUrl = isDevelopment
            ? (process.env.CLIENT_URL || process.env.FRONTEND_APP_URL || 'http://localhost:5173')
            : (process.env.CLIENT_URL || process.env.FRONTEND_APP_URL || 'https://pethaul.vercel.app')
         return res.redirect(`${clientUrl}/login?error=google_config_error`)
      }
      
      const callbackURL = process.env.GOOGLE_CALLBACK_URL || 
         (process.env.NODE_ENV === 'production' 
            ? `${process.env.API_URL || 'https://pethaul-api.onrender.com'}/auth/google/callback`
            : `http://localhost:${process.env.PORT || 8002}/auth/google/callback`)
      
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID)
      authUrl.searchParams.set('redirect_uri', callbackURL)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('scope', 'profile email')
      authUrl.searchParams.set('access_type', 'offline')
      authUrl.searchParams.set('prompt', 'consent')
      
      res.redirect(authUrl.toString())
   } catch (error) {
      console.error('Google OAuth 시작 오류:', error.message)
      const isDevelopment = process.env.NODE_ENV !== 'production'
      const clientUrl = isDevelopment
         ? (process.env.CLIENT_URL || process.env.FRONTEND_APP_URL || 'http://localhost:5173')
         : (process.env.CLIENT_URL || process.env.FRONTEND_APP_URL || 'https://pethaul-frontend.onrender.com')
      res.redirect(`${clientUrl}/login?error=google_auth_failed`)
   }
})

// Google 로그인 콜백 처리
router.get('/google/callback', async (req, res) => {
   const isDevelopment = process.env.NODE_ENV !== 'production'
   const clientUrl = isDevelopment
      ? (process.env.CLIENT_URL || process.env.FRONTEND_APP_URL || 'http://localhost:5173')
      : (process.env.CLIENT_URL || process.env.FRONTEND_APP_URL || 'https://pethaul.vercel.app')
   
   try {
      if (req.query.error) {
         if (req.query.error === 'access_denied') {
            return res.redirect(`${clientUrl}/login?error=access_denied`)
         }
         return res.redirect(`${clientUrl}/login?error=google_auth_failed`)
      }
      
      if (!req.query.code) {
         console.error('Google OAuth: code 없음')
         return res.redirect(`${clientUrl}/login?error=google_auth_failed`)
      }
      
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
         console.error('Google OAuth: 환경 변수 미설정')
         return res.redirect(`${clientUrl}/login?error=google_config_error`)
      }
      
      if (process.env.GOOGLE_CLIENT_ID.trim() === '' || process.env.GOOGLE_CLIENT_SECRET.trim() === '') {
         console.error('Google OAuth: 환경 변수 비어있음')
         return res.redirect(`${clientUrl}/login?error=google_config_error`)
      }
      
      // Callback URL 구성
      const callbackURL = process.env.GOOGLE_CALLBACK_URL || 
         (process.env.NODE_ENV === 'production' 
            ? `${process.env.API_URL || 'https://pethaul-api.onrender.com'}/auth/google/callback`
            : `http://localhost:${process.env.PORT || 8002}/auth/google/callback`)
      
      // 1단계: code를 access_token으로 교환
      console.log('🔄 Google OAuth 토큰 교환 시작...', {
         hasCode: !!req.query.code,
         codeLength: req.query.code?.length,
         hasClientId: !!process.env.GOOGLE_CLIENT_ID,
         hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
         callbackURL,
         clientIdPrefix: process.env.GOOGLE_CLIENT_ID?.substring(0, 10) + '...',
      })
      
      // URLSearchParams 대신 수동으로 URL 인코딩 (Node.js 호환성)
      const tokenParams = [
         `code=${encodeURIComponent(req.query.code)}`,
         `client_id=${encodeURIComponent(process.env.GOOGLE_CLIENT_ID)}`,
         `client_secret=${encodeURIComponent(process.env.GOOGLE_CLIENT_SECRET)}`,
         `redirect_uri=${encodeURIComponent(callbackURL)}`,
         `grant_type=authorization_code`,
      ].join('&')
      
      const tokenResponse = await new Promise((resolve, reject) => {
         const postData = tokenParams
         
         const options = {
            hostname: 'oauth2.googleapis.com',
            path: '/token',
            method: 'POST',
            headers: {
               'Content-Type': 'application/x-www-form-urlencoded',
               'Content-Length': Buffer.byteLength(postData),
            },
         }
         
         const reqToken = https.request(options, (resToken) => {
            let data = ''
            resToken.on('data', (chunk) => { data += chunk })
            resToken.on('end', () => {
               try {
                  const parsed = JSON.parse(data)
                  
                  if (resToken.statusCode === 200) {
                     resolve(parsed)
                  } else {
                     console.error('Google 토큰 교환 실패:', {
                        statusCode: resToken.statusCode,
                        error: parsed.error,
                        errorDescription: parsed.error_description,
                     })
                     reject(new Error(parsed.error_description || parsed.error || 'Token exchange failed'))
                  }
               } catch (err) {
                  console.error('Google 토큰 교환 응답 파싱 오류:', err.message)
                  reject(err)
               }
            })
         })
         
         reqToken.on('error', (err) => {
            console.error('Google 토큰 교환 네트워크 오류:', err.message)
            reject(err)
         })
         
         reqToken.write(postData)
         reqToken.end()
      })
      
      const { access_token } = tokenResponse
      if (!access_token) {
         console.error('Google OAuth: access_token 없음')
         return res.redirect(`${clientUrl}/login?error=google_auth_failed`)
      }
      
      // 2단계: access_token으로 사용자 정보 가져오기
      const userInfo = await new Promise((resolve, reject) => {
         const options = {
            hostname: 'www.googleapis.com',
            path: '/oauth2/v2/userinfo',
            method: 'GET',
            headers: {
               'Authorization': `Bearer ${access_token}`,
            },
         }
         
         https.get(options, (resUserInfo) => {
            let data = ''
            resUserInfo.on('data', (chunk) => { data += chunk })
            resUserInfo.on('end', () => {
               try {
                  const parsed = JSON.parse(data)
                  if (resUserInfo.statusCode === 200) {
                     resolve(parsed)
                  } else {
                     console.error('Google 사용자 정보 가져오기 실패:', {
                        statusCode: resUserInfo.statusCode,
                        error: parsed.error?.message,
                     })
                     reject(new Error(parsed.error?.message || 'Failed to get user info'))
                  }
               } catch (err) {
                  reject(err)
               }
            })
         }).on('error', (err) => {
            console.error('Google 사용자 정보 네트워크 오류:', err.message)
            reject(err)
         })
      })
      
      if (!userInfo.email) {
         console.error('Google OAuth: 사용자 정보에 이메일 없음')
         return res.redirect(`${clientUrl}/login?error=google_auth_failed`)
      }
      
      // 3단계: 사용자 조회 또는 생성
      let user = await User.findOne({
         where: { email: userInfo.email },
      })
      
      if (user) {
         if (user.provider !== 'google') {
            await user.update({ provider: 'google' })
            user = await User.findOne({ where: { id: user.id } })
         }
      } else {
         let userId = `google_${userInfo.id}`
         let existingUserWithId = await User.findOne({ where: { userId } })
         let counter = 1
         while (existingUserWithId) {
            userId = `google_${userInfo.id}_${counter}`
            existingUserWithId = await User.findOne({ where: { userId } })
            counter++
         }
         
         user = await User.create({
            userId: userId,
            name: userInfo.name || userInfo.given_name || 'Google User',
            email: userInfo.email,
            password: null,
            provider: 'google',
         })
      }
      
      // 4단계: 세션 로그인
      req.logIn(user, { session: true }, async (loginErr) => {
         if (loginErr) {
            console.error('세션 로그인 오류:', loginErr.message)
            return res.redirect(`${clientUrl}/login?error=session_failed`)
         }
         
         // 5단계: JWT 토큰 발급
         let token = null
         try {
            if (process.env.JWT_SECRET && user.id) {
               const jwt = require('jsonwebtoken')
               const { Domain } = require('../models')
               const origin = req.get('origin') || req.headers.host || 'unknown'
               
               token = jwt.sign(
                  { id: user.id, email: user.email || '' },
                  process.env.JWT_SECRET,
                  { expiresIn: '365d', issuer: 'pethaul' }
               )
               
               const [row] = await Domain.findOrCreate({
                  where: { userId: user.id, host: origin },
                  defaults: { clientToken: token },
               })
               if (!row.isNewRecord) {
                  row.clientToken = token
                  await row.save()
               }
            }
         } catch (tokenError) {
            console.error('JWT 토큰 발급 실패:', tokenError.message)
         }
         
         // 6단계: 프론트엔드로 리다이렉트
         const redirectUrl = token 
            ? `${clientUrl}/google-success?token=${encodeURIComponent(token)}`
            : `${clientUrl}/google-success`
         
         return res.redirect(redirectUrl)
      })
   } catch (error) {
      console.error('Google OAuth 콜백 오류:', error.message)
      return res.redirect(`${clientUrl}/login?error=google_auth_failed`)
   }
})

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
router.put('/', authenticateToken, async (req, res, next) => {
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
