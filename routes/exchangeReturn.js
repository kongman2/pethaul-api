const express = require('express')
const router = express.Router()
const { authenticateToken, isAdmin } = require('./middlewares')
const { ExchangeReturn, Order, User, Item } = require('../models')

/**
 * 교환/반품 신청 (사용자)
 */
router.post('/', authenticateToken, async (req, res, next) => {
   try {
      const { orderId, type, reason } = req.body

      if (!orderId || !type || !reason) {
         return res.status(400).json({ success: false, message: '필수 정보가 누락되었습니다.' })
      }

      if (!['EXCHANGE', 'RETURN'].includes(type)) {
         return res.status(400).json({ success: false, message: '잘못된 교환/반품 유형입니다.' })
      }

      // 주문 확인
      const order = await Order.findOne({
         where: { id: orderId, userId: req.user.id },
      })

      if (!order) {
         return res.status(404).json({ success: false, message: '주문을 찾을 수 없습니다.' })
      }

      if (order.orderStatus !== 'DELIVERED') {
         return res.status(400).json({ success: false, message: '배송 완료된 주문만 교환/반품 신청이 가능합니다.' })
      }

      // 이미 신청한 교환/반품이 있는지 확인
      const existing = await ExchangeReturn.findOne({
         where: { orderId, status: 'PENDING' },
      })

      if (existing) {
         return res.status(400).json({ success: false, message: '이미 처리 대기 중인 교환/반품 신청이 있습니다.' })
      }

      const exchangeReturn = await ExchangeReturn.create({
         orderId,
         userId: req.user.id,
         type,
         reason,
         status: 'PENDING',
      })

      return res.status(201).json({
         success: true,
         message: '교환/반품 신청이 완료되었습니다.',
         exchangeReturn,
      })
   } catch (error) {
      return next(error)
   }
})

/**
 * 내 교환/반품 신청 목록 조회 (사용자)
 */
router.get('/my', authenticateToken, async (req, res, next) => {
   try {
      const exchangeReturns = await ExchangeReturn.findAll({
         where: { userId: req.user.id },
         include: [
            {
               model: Order,
               attributes: ['id', 'orderDate', 'orderStatus'],
               include: [
                  {
                     model: Item,
                     attributes: ['id', 'itemNm'],
                     through: { attributes: ['orderPrice', 'count'] },
                     required: false,
                  },
               ],
            },
         ],
         order: [['createdAt', 'DESC']],
      })

      // Order의 총 금액 계산 (OrderItem의 orderPrice 합산)
      const exchangeReturnsWithTotal = exchangeReturns.map((er) => {
         const orderJson = er.toJSON()
         if (orderJson.Order && orderJson.Order.Items) {
            const orderPrice = orderJson.Order.Items.reduce((sum, item) => {
               return sum + (item.OrderItem?.orderPrice || 0) * (item.OrderItem?.count || 0)
            }, 0)
            orderJson.Order.orderPrice = orderPrice
         }
         return orderJson
      })

      return res.json({ success: true, exchangeReturns: exchangeReturnsWithTotal })
   } catch (error) {
      return next(error)
   }
})

/**
 * 전체 교환/반품 신청 목록 조회 (관리자)
 */
router.get('/all', authenticateToken, isAdmin, async (req, res, next) => {
   try {
      const exchangeReturns = await ExchangeReturn.findAll({
         include: [
            {
               model: Order,
               attributes: ['id', 'orderDate', 'orderStatus'],
               include: [
                  {
                     model: Item,
                     attributes: ['id', 'itemNm'],
                     through: { attributes: ['orderPrice', 'count'] },
                     required: false,
                  },
               ],
            },
            {
               model: User,
               attributes: ['id', 'name', 'phoneNumber'],
            },
         ],
         order: [['createdAt', 'DESC']],
      })

      // Order의 총 금액 계산 (OrderItem의 orderPrice 합산)
      const exchangeReturnsWithTotal = exchangeReturns.map((er) => {
         const orderJson = er.toJSON()
         if (orderJson.Order && orderJson.Order.Items) {
            const orderPrice = orderJson.Order.Items.reduce((sum, item) => {
               return sum + (item.OrderItem?.orderPrice || 0) * (item.OrderItem?.count || 0)
            }, 0)
            orderJson.Order.orderPrice = orderPrice
         }
         return orderJson
      })

      return res.json({ success: true, exchangeReturns: exchangeReturnsWithTotal })
   } catch (error) {
      return next(error)
   }
})

/**
 * 교환/반품 상태 변경 (관리자)
 */
router.patch('/:id/status', authenticateToken, isAdmin, async (req, res, next) => {
   try {
      const { id } = req.params
      const { status, adminComment } = req.body

      if (!status || !['APPROVED', 'REJECTED', 'COMPLETED'].includes(status)) {
         return res.status(400).json({ success: false, message: '유효하지 않은 상태입니다.' })
      }

      const exchangeReturn = await ExchangeReturn.findByPk(id)

      if (!exchangeReturn) {
         return res.status(404).json({ success: false, message: '교환/반품 신청을 찾을 수 없습니다.' })
      }

      exchangeReturn.status = status
      if (adminComment) {
         exchangeReturn.adminComment = adminComment
      }
      await exchangeReturn.save()

      return res.json({
         success: true,
         message: `교환/반품 신청이 ${status === 'APPROVED' ? '승인' : status === 'REJECTED' ? '거부' : '완료'}되었습니다.`,
         exchangeReturn,
      })
   } catch (error) {
      return next(error)
   }
})

module.exports = router

