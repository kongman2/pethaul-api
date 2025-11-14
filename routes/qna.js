// routes/qna.js
const express = require('express')
const { isLoggedIn, isAdmin } = require('./middlewares')
const { Qna, Item } = require('../models')
const { InvalidConnectionError } = require('sequelize')
const User = require('../models/user')
const router = express.Router()

// 문의글 전체 조회
router.get('/', async (req, res, next) => {
   try {
      const { id, role } = req.query
      const page = parseInt(req.query.page, 10) || 1
      const limit = parseInt(req.query.limit, 10) || 10
      const offset = (page - 1) * limit

      if (!id) {
         const error = new Error('회원 정보를 찾을 수 없습니다.')
         error.status = 404
         throw error
      }

      if (role === 'ADMIN') {
         const count = await Qna.count()
         const data = await Qna.findAll({
            include: [
               {
               model: User,
               attributes: ['id', 'userId', 'name'],
            },
               {
                  model: Item,
                  attributes: ['id', 'itemNm'],
                  required: false,
               },
            ],
            limit,
            offset,
            order: [['createdAt', 'DESC']],
         })
         res.json({
            data,
            pagination: {
               totalQna: count,
               totalPages: Math.ceil(count / limit),
               currentPage: page,
               limit,
            },
         })
      } else {
         const count = await Qna.count({ where: { userId: id } })
         const data = await Qna.findAll({
            where: { userId: id },
            include: [
               {
               model: User,
               attributes: ['id', 'userId', 'name'],
            },
               {
                  model: Item,
                  attributes: ['id', 'itemNm'],
                  required: false,
               },
            ],
            limit,
            offset,
            order: [['createdAt', 'DESC']],
         })
         res.json({
            data,
            pagination: {
               totalQna: count,
               totalPages: Math.ceil(count / limit),
               currentPage: page,
               limit,
            },
         })
      }
   } catch (error) {
      error.status = error.status || 500
      error.message = '데이터를 불러오는 중 오류가 발생했습니다.'
      next(error)
   }
})

// 문의글 상세 조회
router.get('/:id', async (req, res, next) => {
   try {
      const qna = await Qna.findByPk(req.params.id, {
         include: [
            {
            model: User,
            attributes: ['id', 'userId', 'name'],
         },
            {
               model: Item,
               attributes: ['id', 'itemNm'],
               required: false,
            },
         ],
      })
      if (!qna) {
         const error = new Error('해당 문의 데이터를 찾을 수 없습니다.')
         error.status = 404
         throw error
      }

      res.status(200).json({ qna })
   } catch (error) {
      error.status = error.status || 500
      error.message = '데이터를 불러오는 중 오류가 발생했습니다.'
      next(error)
   }
})

// 상품별 문의 조회
router.get('/item/:itemId', async (req, res, next) => {
   try {
      const { itemId } = req.params
      const page = parseInt(req.query.page, 10) || 1
      const limit = parseInt(req.query.limit, 10) || 10
      const offset = (page - 1) * limit

      const count = await Qna.count({ where: { itemId } })
      const data = await Qna.findAll({
         where: { itemId },
         include: [
            {
               model: User,
               attributes: ['id', 'userId', 'name'],
            },
         ],
         limit,
         offset,
         order: [['createdAt', 'DESC']],
      })

      res.json({
         data,
         pagination: {
            totalQna: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            limit,
         },
      })
   } catch (error) {
      error.status = error.status || 500
      error.message = '상품 문의 조회 중 오류가 발생했습니다.'
      next(error)
   }
})

//문의글 작성
router.post('/', isLoggedIn, async (req, res, next) => {
   try {
      const { title, content, itemId, isPrivate } = req.body

      const userId = req.user.id

      const qna = await Qna.create({ title, content, userId, itemId: itemId || null, isPrivate: isPrivate || false })
      res.status(201).json({
         message: '문의가 성공적으로 등록되었습니다.',
         qna,
      })
   } catch (error) {
      error.status = error.status || 500
      error.message = '문의를 작성하는 중 오류가 발생했습니다.'
      next(error)
   }
})

//문의글 수정
router.put('/edit/:id', isLoggedIn, async (req, res, next) => {
   try {
      const { title, content, isPrivate } = req.body
      const qna = await Qna.findByPk(req.params.id)

      if (!qna) {
         const error = new Error('해당 게시글을 찾을 수 없습니다.')
         error.status = 404
         return next(error)
      }
      if (qna.userId !== req.user.id) {
         const error = new Error('권한이 없습니다.')
         error.status = 403
         return next(error)
      }
      await qna.update({ title, content, isPrivate: isPrivate !== undefined ? isPrivate : qna.isPrivate })
      res.status(200).json({
         message: '문의가 성공적으로 수정되었습니다.',
      })
   } catch (error) {
      error.status = error.status || 500
      error.message = '문의를 수정하는 중 오류가 발생했습니다.'
      next(error)
   }
})

//문의글 삭제
router.delete('/:id', isLoggedIn, async (req, res, next) => {
   try {
      const qna = await Qna.findByPk(req.params.id)
      if (!qna) {
         const error = new Error('해당 게시글을 찾을 수 없습니다.')
         error.status = 404
         return next(error)
      }

      if (req.user.role === 'USER') {
         if (qna.userId !== req.user.id) {
            const error = new Error('권한이 없습니다.')
            error.status = 403
            return next(error)
         }
      }
      await qna.destroy()
      res.status(200).json({ message: '문의글을 삭제했습니다.' })
   } catch (error) {
      error.status = error.status || 500
      error.message = '문의를 삭제하는 중 오류가 발생했습니다.'
      next(error)
   }
})

//(관리자용) 문의글에 답글 달기
router.patch('/comment/:id', isAdmin, async (req, res, next) => {
   try {
      const comment = req.body.comment

      const qna = await Qna.findByPk(req.params.id)

      if (!qna) {
         const error = new Error('해당 문의글을 찾을 수 없습니다.')
         error.status = 404
         return next(error)
      }
      await qna.update({ comment })
      res.status(200).json({ message: '문의에 답글을 작성했습니다.' })
   } catch (error) {
      error.status = error.status || 500
      error.message = '문의에 답글을 작성하는 중 오류가 발생했습니다.'
      next(error)
   }
})

module.exports = router
