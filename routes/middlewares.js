// routes/middlewares.js
const jwt = require('jsonwebtoken')
const { User } = require('../models')

// 로그인 상태 확인 미들웨어: 사용자가 로그인된 상태인지 확인 (세션 기반)
exports.isLoggedIn = (req, res, next) => {
   if (req.isAuthenticated()) {
      next() // 로그인이 됐으면 다음 미들웨어로 이동
   } else {
      // 로그인이 되지 않았을경우 에러 미들웨어로 에러 전송
      const error = new Error('로그인이 필요합니다.')
      error.status = 403
      return next(error)
   }
}

// JWT 토큰 기반 인증 미들웨어: 토큰을 검증하고 req.user를 설정
// 토큰이 없거나 유효하지 않으면 세션 기반 인증으로 폴백
exports.authenticateToken = async (req, res, next) => {
   const authHeader = req.headers.authorization
   
   // 1. 토큰이 있는 경우: 토큰 검증 시도
   if (authHeader) {
      try {
         // AUTH_KEY와 토큰 구분 (AUTH_KEY는 공개 API용이므로 토큰 검증 건너뛰기)
         // AUTH_KEY는 환경변수에서 가져온 값과 비교
         if (authHeader === process.env.AUTH_KEY) {
            // AUTH_KEY인 경우 세션 확인으로 폴백
            if (req.isAuthenticated() && req.user) {
               return next()
            }
            const error = new Error('로그인이 필요합니다.')
            error.status = 401
            return next(error)
         }

         // JWT 토큰 검증
         const decoded = jwt.verify(authHeader, process.env.JWT_SECRET)
         
         // 토큰에서 사용자 정보 가져오기
         const user = await User.findByPk(decoded.id)
         
         if (!user) {
            // 토큰은 유효하지만 사용자가 없으면 세션 확인으로 폴백
            if (req.isAuthenticated() && req.user) {
               return next()
            }
            const error = new Error('사용자를 찾을 수 없습니다.')
            error.status = 401
            return next(error)
         }

         // 토큰이 유효하고 사용자가 있으면 토큰 사용
         req.user = user
         req.decoded = decoded
         return next()
      } catch (error) {
         // 토큰 검증 실패 시 세션 확인으로 폴백
         if (req.isAuthenticated() && req.user) {
            return next()
         }

         // 세션도 없으면 에러 반환
         if (error.name === 'TokenExpiredError') {
            error.status = 419
            error.message = '토큰이 만료되었습니다. 다시 로그인해주세요.'
            return next(error)
         }

         if (error.name === 'JsonWebTokenError') {
            error.status = 401
            error.message = '유효하지 않은 토큰입니다.'
            return next(error)
         }

         error.status = error.status || 401
         error.message = error.message || '인증 중 오류가 발생했습니다.'
         return next(error)
      }
   }
   
   // 2. 토큰이 없는 경우: 세션 기반 인증으로 폴백
   if (req.isAuthenticated() && req.user) {
      return next()
   }
   
   // 3. 둘 다 없는 경우: 에러 반환
   const error = new Error('로그인이 필요합니다.')
   error.status = 401
   return next(error)
}

// 비로그인 상태 확인 미들웨어: 사용자가 로그인 안된 상태인지 확인
exports.isNotLoggedIn = (req, res, next) => {
   if (!req.isAuthenticated()) {
      // 로그인이 되지 않았을 경우 다음 미들웨어로 이동
      next()
   } else {
      // 로그인이 된 경우 에러 미들웨어로 에러 전송
      const error = new Error('이미 로그인이 된 상태입니다.')
      error.status = 400
      return next(error)
   }
}

// 관리자 권한 확인 미들웨어
exports.isAdmin = (req, res, next) => {
   // 로그인 상태 확인
   if (req.isAuthenticated()) {
      // 사용자 권한 확인
      if (req.user && req.user.role === 'ADMIN') {
         next() // role이 ADMIN이면 다음 미들웨어로 이동
      } else {
         //권한 부족
         const error = new Error('관리자 권한이 필요합니다.')
         error.status = 403
         return next(error)
      }
   } else {
      const error = new Error('로그인이 필요합니다.')
      error.status = 403
      return next(error)
   }
}

// 토큰 유효성 확인
exports.verifyToken = (req, res, next) => {
   try {
      // 프론트엔드에서 전달한 토큰

      // 토큰 검증
      req.decoded = jwt.verify(req.headers.authorization, process.env.JWT_SECRET)

      return next() // 다음 미들웨어 이동
   } catch (error) {
      // 토큰 유효기간 초과
      if (error.name === 'TokenExpiredError') {
         error.status = 419
         error.message = '토큰이 만료되었습니다.'
         return next(error)
      }

      // 유효하지 않은 토큰
      error.status = 401
      error.message = '유효하지 않은 토큰입니다.'
      return next(error)
   }
}
