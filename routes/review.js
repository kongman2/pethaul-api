// routes/review.js
const express = require('express')
const { sequelize, Review, Item, ItemImage, ReviewImage, User } = require('../models')
const { authenticateToken } = require('./middlewares')
const fs = require('fs')
const path = require('path')
const multer = require('multer')

const router = express.Router()

// 📌 한글/특수문자 파일명 복구 유틸 (업로드 일관성)
function decodeOriginalName(raw) {
   const utf8 = Buffer.from(raw, 'latin1').toString('utf8')
   if (/%[0-9A-Fa-f]{2}/.test(utf8)) {
      try {
         return decodeURIComponent(utf8)
      } catch {}
   }
   return utf8
}

// uploads 폴더 준비
try {
   fs.readdirSync('uploads')
} catch (error) {
   fs.mkdirSync('uploads')
}

// multer 설정
const upload = multer({
   storage: multer.diskStorage({
      destination(req, file, cb) {
         cb(null, 'uploads/')
      },
      filename(req, file, cb) {
         const decodedFileName = decodeOriginalName(file.originalname)
         const ext = path.extname(decodedFileName)
         const basename = path.basename(decodedFileName, ext)
         cb(null, basename + Date.now() + ext)
      },
   }),
   limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
})

/**
 * 리뷰 등록
 * [POST] /
 * form-data: itemId, reviewDate, reviewContent, rating, img[]
 */
router.post('/', authenticateToken, upload.array('img'), async (req, res, next) => {
   const t = await sequelize.transaction()
   try {
      const { itemId, reviewDate, reviewContent, rating } = req.body
      const userId = req.user.id

      const review = await Review.create({ itemId, userId, reviewDate, reviewContent, rating }, { transaction: t })

      let reviewImages = []
      if (req.files?.length > 0) {
         reviewImages = req.files.map((file) => ({
            oriImgName: decodeOriginalName(file.originalname),
            imgUrl: `/${file.filename}`,
            reviewId: review.id,
         }))
         await ReviewImage.bulkCreate(reviewImages, { transaction: t })
      }

      await t.commit()
      res.status(201).json({
         success: true,
         message: '후기가 성공적으로 등록되었습니다.',
         review,
         reviewImages,
      })
   } catch (error) {
      await t.rollback()
      error.status = error.status || 500
      error.message = '후기 등록 중 오류가 발생했습니다.'
      next(error)
   }
})

/**
 * 리뷰 수정 (이미지 재업로드 시 전부 교체)
 * [PUT] /edit/:id
 */
router.put('/edit/:id', authenticateToken, upload.array('img'), async (req, res, next) => {
   try {
      const { itemId, reviewDate, reviewContent, rating } = req.body
      const review = await Review.findByPk(req.params.id)

      if (!review) {
         const error = new Error('해당 후기를 찾을 수 없습니다.')
         error.status = 404
         return next(error)
      }
      if (review.userId !== req.user.id) {
         const error = new Error('권한이 없습니다.')
         error.status = 403
         return next(error)
      }

      await review.update({ itemId, reviewDate, reviewContent, rating })

      if (req.files && req.files.length > 0) {
         await ReviewImage.destroy({ where: { reviewId: review.id } })
         const reviewImages = req.files.map((file) => ({
            oriImgName: decodeOriginalName(file.originalname),
            imgUrl: `/${file.filename}`,
            reviewId: review.id,
         }))
         await ReviewImage.bulkCreate(reviewImages)
      }

      res.json({ success: true, message: '후기를 성공적으로 수정했습니다.' })
   } catch (error) {
      error.status = error.status || 500
      error.message = '리뷰 수정 중 오류가 발생했습니다.'
      next(error)
   }
})

/**
 * 리뷰 삭제
 * [DELETE] /:id
 */
router.delete('/:id', authenticateToken, async (req, res, next) => {
   try {
      const { id } = req.params
      const review = await Review.findByPk(id)

      if (!review) {
         const error = new Error('해당 후기를 찾을 수 없습니다.')
         error.status = 404
         return next(error)
      }
      if (review.userId !== req.user.id) {
         const error = new Error('권한이 없습니다.')
         error.status = 403
         return next(error)
      }

      await review.destroy()
      res.status(200).json({ success: true, message: '후기가 삭제되었습니다.' })
   } catch (error) {
      error.status = error.status || 500
      error.message = '리뷰 삭제 중 오류가 발생했습니다.'
      next(error)
   }
})

/**
 * 회원이 작성한 리뷰 목록 조회
 * [GET] /
 */
router.get('/', authenticateToken, async (req, res, next) => {
   try {
      const page = parseInt(req.query.page, 10) || 1
      const limit = parseInt(req.query.limit, 10) || 5
      const offset = (page - 1) * limit

      const count = await Review.count({
         where: {
            userId: req.user.id,
         },
      })

      const review = await Review.findAll({
         where: { userId: req.user.id },
         limit,
         offset,
         include: [
            {
               model: Item,
               attributes: ['id', 'itemNm', 'price'],
               include: {
                  model: ItemImage,
                  attributes: ['id', 'oriImgName', 'imgUrl', 'repImgYn'],
               },
            },
            {
               model: ReviewImage,
               attributes: ['id', 'oriImgName', 'imgUrl'],
            },
         ],
         order: [['createdAt', 'DESC']],
      })

      res.status(200).json({
         success: true,
         message: '회원이 작성한 리뷰를 성공적으로 불러왔습니다.',
         review,
         pagination: {
            totalReview: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            limit,
         },
      })
   } catch (error) {
      error.status = error.status || 500
      error.message = '데이터를 불러오는 중 오류가 발생했습니다.'
      next(error)
   }
})

router.get('/latest', async (req, res, next) => {
   try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1)
      const size = Math.max(1, parseInt(req.query.size, 10) || 6)
      const offset = (page - 1) * size

      const { rows, count } = await Review.findAndCountAll({
         include: [
            { model: ReviewImage },
            { model: User, attributes: ['id', 'name'] },
            {
               model: Item,
               attributes: ['id', 'itemNm', 'price'],
               // 아이템 이미지 1장만 원하면 별도(hasMany) include에 separate + limit
               include: [{ model: ItemImage, separate: true, limit: 1 }],
               // alias를 쓰셨다면 { model: ItemImage, as: 'ItemImages', separate: true, limit: 1 }
            },
         ],
         order: [['createdAt', 'DESC']],
         limit: size,
         offset,
      })

      res.json({
         list: rows.map((r) => r.get({ plain: true })), // 순수 객체로 변환
         page,
         size,
         total: count,
         hasMore: page * size < count,
      })
   } catch (err) {
      next(err)
   }
})

module.exports = router
