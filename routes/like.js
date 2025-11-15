const express = require('express')
const { Like, Item, ItemImage, Category } = require('../models')
const { authenticateToken } = require('./middlewares')

const router = express.Router()

/**
 * 내가 좋아요한 상품 목록 조회
 * - 조건: req.user.id
 * - 반환: 상품 id / 이름 / 가격 / 대표이미지 포함
 */
router.get('/me', authenticateToken, async (req, res, next) => {
   try {
      const likes = await Like.findAll({
         where: { userId: req.user.id },
         include: [
            {
               model: Item,
               attributes: ['id', 'itemNm', 'price', 'itemSellStatus'],
               include: [
                  { model: ItemImage, attributes: ['id', 'oriImgName', 'imgUrl', 'repImgYn'], separate: false },
                  { model: Category, attributes: ['id', 'categoryName'], through: { attributes: [] } },
               ],
            },
         ],
      })

      return res.status(200).json({
         success: true,
         items: likes.map((like) => like.Item), // 상품 데이터만 전달
      })
   } catch (err) {
      err.status = err.status || 500
      err.message = '좋아요 상품 조회 실패'
      return next(err)
   }
})

router.get('/ids', authenticateToken, async (req, res, next) => {
   try {
      const rows = await Like.findAll({
         where: { userId: req.user.id },
         attributes: ['itemId'],
      })
      return res.json({ itemIds: rows.map((r) => r.itemId) })
   } catch (err) {
      err.status = err.status || 500
      err.message = '좋아요 ID 목록 조회 실패'
      return next(err)
   }
})

/**
 * 좋아요 토글
 * - 이미 존재하면 삭제 → liked: false
 * - 없으면 생성 → liked: true
 */
router.post('/:itemId', authenticateToken, async (req, res, next) => {
   try {
      const { itemId } = req.params

      // 숫자 유효성 (선택적, 안전장치)
      if (!itemId || Number.isNaN(Number(itemId))) {
         const error = new Error('유효하지 않은 itemId 입니다.')
         error.status = 400
         return next(error)
      }

      const existing = await Like.findOne({ where: { userId: req.user.id, itemId } })

      if (existing) {
         await existing.destroy()
         return res.status(200).json({ success: true, liked: false })
      }

      await Like.create({ userId: req.user.id, itemId })
      return res.status(201).json({ success: true, liked: true })
   } catch (err) {
      err.status = err.status || 500
      err.message = '좋아요 토글 실패'
      return next(err)
   }
})

module.exports = router
