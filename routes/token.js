// routes/token.js
const express = require('express')
const jwt = require('jsonwebtoken')
const { Domain } = require('../models')
const { isLoggedIn, isAdmin, verifyToken } = require('./middlewares')

const router = express.Router()

/**
 * 토큰 발급 (저장까지)
 * - 동일 userId/host 조합이 이미 있으면 갱신, 없으면 생성
 */
router.get('/get', isLoggedIn, async (req, res, next) => {
   try {
      // req.user 확인 (isLoggedIn 미들웨어를 통과했지만 req.user가 없을 수 있음)
      if (!req.user) {
         const error = new Error('사용자 정보를 찾을 수 없습니다. 세션이 만료되었거나 유효하지 않습니다.')
         error.status = 401
         return next(error)
      }

      if (!req.user.id) {
         const error = new Error('사용자 ID를 찾을 수 없습니다.')
         error.status = 401
         return next(error)
      }

      const origin = req.get('origin') || req.headers.host

      // 필수 설정 체크
      if (!process.env.JWT_SECRET) {
         const error = new Error('서버 설정 오류: JWT_SECRET이 설정되어 있지 않습니다.')
         error.status = 500
         return next(error)
      }

      // JWT 토큰 생성
      let token
      try {
         token = jwt.sign({ id: req.user.id, email: req.user.email || '' }, process.env.JWT_SECRET, { expiresIn: '365d', issuer: 'pethaul' })
      } catch (jwtError) {
         const error = new Error('토큰 생성 중 오류가 발생했습니다.')
         error.status = 500
         if (process.env.NODE_ENV === 'development') {
            console.error('JWT 생성 오류:', jwtError)
         }
         return next(error)
      }

      // 동일 (userId, host) 가 있으면 갱신, 없으면 생성
      try {
         const [row, created] = await Domain.findOrCreate({
            where: { userId: req.user.id, host: origin },
            defaults: { clientToken: token },
         })
         if (!created) {
            row.clientToken = token
            await row.save()
         }
      } catch (dbError) {
         // 데이터베이스 오류 처리
         const error = new Error('토큰 저장 중 오류가 발생했습니다.')
         error.status = 500
         if (process.env.NODE_ENV === 'development') {
            console.error('DB 오류:', dbError)
         }
         return next(error)
      }

      return res.json({ success: true, message: '토큰이 발급되었습니다.', token })
   } catch (error) {
      // 예상치 못한 오류 처리
      if (process.env.NODE_ENV === 'development') {
         console.error('토큰 발급 오류:', error)
         console.error('req.user:', req.user)
         console.error('req.isAuthenticated():', req.isAuthenticated())
      }
      error.status = error.status || 500
      error.message = error.message || '토큰 발급 중 오류가 발생했습니다.'
      return next(error)
   }
})

/**
 * DB에 저장된 토큰 조회 (관리자)
 */
router.get('/read', isAdmin, async (req, res, next) => {
   try {
      const origin = req.get('origin') || req.headers.host
      const userId = req.user.id

      const domainData = await Domain.findOne({ where: { userId, host: origin } })
      if (!domainData) {
         const error = new Error('토큰이 존재하지 않습니다.')
         error.status = 404
         return next(error)
      }

      return res.json({
         success: true,
         message: '토큰을 성공적으로 불러왔습니다.',
         token: domainData.clientToken,
      })
   } catch (error) {
      error.status = error.status || 500
      error.message = error.message || '토큰을 불러오는 중 오류가 발생했습니다.'
      return next(error)
   }
})

/**
 * 토큰 재발급 (기존 레코드가 있을 때만)
 */
router.get('/refresh', isLoggedIn, async (req, res, next) => {
   try {
      const origin = req.get('origin') || req.headers.host
      const domainData = await Domain.findOne({ where: { userId: req.user.id, host: origin } })
      if (!domainData) {
         const error = new Error('토큰이 존재하지 않습니다.')
         error.status = 404
         return next(error)
      }

      if (!process.env.JWT_SECRET) {
         const error = new Error('서버 설정 오류: JWT_SECRET이 설정되어 있지 않습니다.')
         error.status = 500
         return next(error)
      }

      const newToken = jwt.sign({ id: req.user.id, email: req.user.email, nonce: Math.random().toString(36).slice(2) }, process.env.JWT_SECRET, { expiresIn: '365d', issuer: 'pethaul' })

      domainData.clientToken = newToken
      await domainData.save()

      return res.json({ success: true, message: '토큰이 성공적으로 재발급되었습니다.', token: newToken })
   } catch (error) {
      error.status = error.status || 500
      error.message = error.message || '토큰을 재발급하는 중 오류가 발생했습니다.'
      return next(error)
   }
})

/**
 * 토큰 유효성 확인
 */
router.get('/checkTokenStatus', verifyToken, async (req, res, next) => {
   try {
      return res.json({ success: true, message: '유효한 토큰입니다.' })
   } catch (error) {
      error.status = error.status || 500
      error.message = error.message || '토큰 유효성 검사 중 오류가 발생했습니다.'
      return next(error)
   }
})

module.exports = router
