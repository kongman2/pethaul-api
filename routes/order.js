// routes/order.js
const express = require('express')
const { Order, OrderItem, Item, ItemImage, Cart, CartItem } = require('../models')
const { authenticateToken } = require('./middlewares')
const { Op, col, fn } = require('sequelize')

const router = express.Router()

/**
 * 주문 생성
 */
router.post('/', authenticateToken, async (req, res, next) => {
   const t = await Order.sequelize.transaction()
   try {
      const { items, delivery } = req.body // [{ itemId, price, quantity }], { name, phone, address, addressDetail, request }
      const userId = req.user.id

      // 입력 검증
      if (!items || !Array.isArray(items) || items.length === 0) {
         const error = new Error('주문할 상품이 없습니다.')
         error.status = 400
         await t.rollback()
         return next(error)
      }

      // items 검증
      for (const it of items) {
         if (!it.itemId || !it.price || !it.quantity) {
            const error = new Error('주문 상품 정보가 올바르지 않습니다.')
            error.status = 400
            await t.rollback()
            return next(error)
         }
      }

      const cart = await Cart.findOne({ where: { userId }, include: [CartItem], transaction: t })
      if (!cart) {
         const error = new Error('장바구니를 찾을 수 없습니다.')
         error.status = 404
         await t.rollback()
         return next(error)
      }

      // 재고 체크
      for (const it of items) {
         const product = await Item.findByPk(it.itemId, { transaction: t })
         if (!product) {
            await t.rollback()
            const error = new Error(`상품 ID ${it.itemId}을 찾을 수 없습니다.`)
            error.status = 404
            return next(error)
         }
         if (product.stockNumber < it.quantity) {
            await t.rollback()
            const error = new Error(`${product.itemNm} 상품 재고가 부족합니다.`)
            error.status = 400
            return next(error)
         }
      }

      // 주문 생성 (delivery 정보 포함)
      const orderData = {
         userId: req.user.id,
         orderDate: new Date(),
         orderStatus: 'ORDER',
      }
      if (delivery) {
         if (delivery.name) orderData.deliveryName = delivery.name
         if (delivery.phone) orderData.deliveryPhone = delivery.phone
         if (delivery.address) orderData.deliveryAddress = delivery.address
         if (delivery.addressDetail) orderData.deliveryAddressDetail = delivery.addressDetail
         if (delivery.request) orderData.deliveryRequest = delivery.request
      }
      const order = await Order.create(orderData, { transaction: t })

      // 주문상품 생성 + 재고 차감
      for (const it of items) {
         // orderPrice 계산: price가 단가인지 총액인지 확인 필요
         // 프론트엔드에서 price * quantity로 보내는지, 아니면 price가 이미 총액인지 확인
         const orderPrice = typeof it.price === 'number' && typeof it.quantity === 'number' 
            ? it.price * it.quantity 
            : it.orderPrice || (it.price * it.quantity)
         
         await OrderItem.create(
            { 
               orderId: order.id, 
               itemId: it.itemId, 
               orderPrice: orderPrice, 
               count: it.quantity 
            }, 
            { transaction: t }
         )

         const product = await Item.findByPk(it.itemId, { transaction: t })
         product.stockNumber -= it.quantity
         await product.save({ transaction: t })
      }

      // 장바구니 비우기
      await CartItem.destroy({ where: { cartId: cart.id }, transaction: t })

      await t.commit()
      return res.status(201).json({ success: true, message: '주문이 완료되었습니다.', orderId: order.id })
   } catch (err) {
      await t.rollback()
      err.status = err.status || 500
      err.message = err.message || '주문 생성 실패'
      return next(err)
   }
})

/**
 * 주문 목록 조회 (내 주문)
 */
router.get('/', authenticateToken, async (req, res, next) => {
   try {
      const page = parseInt(req.query.page, 10) || 1
      const limit = parseInt(req.query.limit, 10) || 5
      const offset = (page - 1) * limit

      // userId 확인
      if (!req.user || !req.user.id) {
         const error = new Error('인증된 사용자 정보가 없습니다.')
         error.status = 401
         return next(error)
      }

      const count = await Order.count({
         where: { userId: req.user.id },
      })
      
      const orders = await Order.findAll({
         where: { userId: req.user.id },
         limit,
         offset,
         order: [['orderDate', 'DESC']],
         include: [
            {
               model: Item,
               attributes: ['id', 'itemNm', 'price'],
               through: { attributes: ['orderPrice', 'count'] },
               include: [
                  {
                     model: ItemImage,
                     attributes: ['id', 'oriImgName', 'imgUrl', 'repImgYn'],
                     required: false,
                  },
               ],
               required: false,
            },
         ],
      })


      // ItemImage에서 repImgYn이 'Y'인 것만 필터링
      const ordersWithFilteredImages = orders.map((order, index) => {
         try {
         const orderJson = order.toJSON()
            
            // Items가 배열인지 확인
            if (orderJson.Items && Array.isArray(orderJson.Items)) {
               orderJson.Items = orderJson.Items.map((item, itemIndex) => {
                  try {
                     // 원본 Sequelize 인스턴스에서 ItemImages 가져오기
                     const originalItem = Array.isArray(order.Items) 
                        ? order.Items.find((i) => i && i.id === item.id)
                        : null
                     
                     // ItemImages 처리
                     if (item.ItemImages && Array.isArray(item.ItemImages) && item.ItemImages.length > 0) {
                        // repImgYn이 'Y'인 이미지만 필터링
                        item.ItemImages = item.ItemImages.filter((img) => img && img.repImgYn === 'Y')
                        
                        // 대표 이미지가 없으면 원본에서 첫 번째 이미지 사용
                        if (item.ItemImages.length === 0 && originalItem?.ItemImages?.length > 0) {
                           const firstImg = originalItem.ItemImages[0]
                           item.ItemImages = [firstImg.toJSON ? firstImg.toJSON() : firstImg]
                        }
                     } else if (originalItem?.ItemImages?.length > 0) {
                        // JSON 변환 시 ItemImages가 없지만 원본에는 있는 경우
                        const firstImg = originalItem.ItemImages[0]
                     item.ItemImages = [firstImg.toJSON ? firstImg.toJSON() : firstImg]
                     } else {
                        // ItemImages가 없는 경우 빈 배열로 설정
                        item.ItemImages = []
               }
                     
               return item
                  } catch (itemErr) {
                     // 에러가 발생한 아이템도 반환 (ItemImages만 빈 배열로)
                     item.ItemImages = item.ItemImages || []
                     return item
                  }
               })
            } else if (orderJson.Items) {
               // Items가 배열이 아닌 경우 빈 배열로 설정
               orderJson.Items = []
            }
            
            return orderJson
         } catch (mapErr) {
            // 에러 발생 시 기본 JSON 반환
            try {
               return order.toJSON()
            } catch (jsonErr) {
               return { id: order.id || null, error: '데이터 변환 실패' }
            }
         }
      })

      return res.status(200).json({
         success: true,
         message: '주문목록 조회 성공',
         orders: ordersWithFilteredImages,
         pagination: {
            totalOrders: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            limit,
         },
      })
   } catch (err) {
      err.status = err.status || 500
      err.message = err.message || '주문목록 조회 실패'
      return next(err)
   }
})

/**
 * 전체 주문 조회(관리자용)
 */
router.get('/all/admin', async (req, res, next) => {
   try {
      const sort = req.query.sort || 'orderDate'
      let orderClause = [['orderDate', 'DESC']]
      let whereClause = {}

      if (sort === 'orderDate') {
         // 최근 주문순
         orderClause = [['orderDate', 'DESC']]
      } else if (sort === 'yesterday') {
         // 전일자 주문 조회
         const yesterday = new Date()
         yesterday.setDate(yesterday.getDate() - 1)
         const startOfYesterday = new Date(yesterday.setHours(0, 0, 0, 0))
         const endOfYesterday = new Date(yesterday.setHours(23, 59, 59, 999))
         whereClause.orderDate = { [Op.between]: [startOfYesterday, endOfYesterday] }
      }

      const orders = await Order.findAll({
         where: whereClause,
         include: [
            {
               model: Item,
               attributes: ['id', 'itemNm', 'price'],
               through: { attributes: ['orderPrice', 'count'] },
               include: [
                  {
                     model: ItemImage,
                     attributes: ['id', 'oriImgName', 'imgUrl'],
                     where: { repImgYn: 'Y' },
                     required: false,
                  },
               ],
            },
            {
               model: require('../models').User,
               attributes: ['id', 'name', 'phoneNumber', 'address', 'addressDetail'],
            },
         ],
         order: orderClause,
      })

      // 주문별 총 금액 계산 및 delivery 정보 추가
      const ordersWithTotal = orders.map((order) => {
         const orderPrice = order.Items?.reduce((sum, item) => {
            return sum + (item.OrderItem?.orderPrice || 0)
         }, 0) || 0

         return {
            ...order.toJSON(),
            orderPrice,
            delivery: {
               name: order.deliveryName || order.User?.name || '',
               phone: order.deliveryPhone || order.User?.phoneNumber || '',
               address: order.deliveryAddress || order.User?.address || '',
               addressDetail: order.deliveryAddressDetail || order.User?.addressDetail || '',
               request: order.deliveryRequest || '',
            },
         }
      })

      return res.json({ success: true, orders: ordersWithTotal })
   } catch (err) {
      err.status = err.status || 500
      err.message = '관리자 주문 조회 실패'
      return next(err)
   }
})

/**
 * 주문 취소 (내 주문)
 */
router.patch('/:id/cancel', authenticateToken, async (req, res, next) => {
   const t = await Order.sequelize.transaction()
   try {
      const order = await Order.findOne({
         where: { id: req.params.id, userId: req.user.id },
         include: [{ model: Item, through: { attributes: ['count'] } }],
         transaction: t,
      })

      if (!order) {
         await t.rollback()
         const error = new Error('주문을 찾을 수 없습니다.')
         error.status = 404
         return next(error)
      }

      // 재고 복구
      for (const it of order.Items) {
         const product = await Item.findByPk(it.id, { transaction: t })
         product.stockNumber += it.OrderItem.count
         await product.save({ transaction: t })
      }

      order.orderStatus = 'CANCEL'
      await order.save({ transaction: t })

      await t.commit()
      return res.json({ success: true, message: '주문이 취소되었습니다.' })
   } catch (err) {
      await t.rollback()
      err.status = err.status || 500
      err.message = '주문 취소 실패'
      return next(err)
   }
})

/**
 * 구매 확정 (사용자)
 */
router.patch('/:id/confirm', authenticateToken, async (req, res, next) => {
   try {
      const order = await Order.findOne({
         where: { id: req.params.id, userId: req.user.id },
      })

      if (!order) {
         const error = new Error('주문을 찾을 수 없습니다.')
         error.status = 404
         return next(error)
      }

      if (order.orderStatus !== 'DELIVERED') {
         const error = new Error('배송 완료된 주문만 구매 확정할 수 있습니다.')
         error.status = 400
         return next(error)
      }

      if (order.isPurchaseConfirmed) {
         const error = new Error('이미 구매 확정된 주문입니다.')
         error.status = 400
         return next(error)
      }

      order.isPurchaseConfirmed = true
      await order.save()

      return res.json({ success: true, message: '구매가 확정되었습니다.', order })
   } catch (err) {
      err.status = err.status || 500
      err.message = '구매 확정 실패'
      return next(err)
   }
})

/**
 * 주문 상세 조회 (내 주문)
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
   try {
      const order = await Order.findOne({
         where: { id: req.params.id, userId: req.user.id },
         include: [{ model: Item, through: { attributes: ['orderPrice', 'count'] } }],
      })

      if (!order) {
         const error = new Error('주문을 찾을 수 없습니다.')
         error.status = 404
         return next(error)
      }

      return res.json({ success: true, order })
   } catch (err) {
      err.status = err.status || 500
      err.message = '주문 상세 조회 실패'
      return next(err)
   }
})

/**
 * 주문 상태 변경 (관리자/시스템 용도로 가정)
 * - 쿼리: ?status=SHIPPING 등
 */
router.patch('/:id', async (req, res, next) => {
   try {
      const newStatus = req.query.status
      if (!newStatus) {
         const error = new Error('변경할 상태(status)가 필요합니다.')
         error.status = 400
         return next(error)
      }

      const order = await Order.findOne({ where: { id: req.params.id } })
      if (!order) {
         const error = new Error('주문을 찾을 수 없습니다.')
         error.status = 404
         return next(error)
      }

      order.orderStatus = newStatus
      await order.save()

      return res.json({ success: true, message: `주문 상태가 ${newStatus}로 변경되었습니다.` })
   } catch (err) {
      err.status = err.status || 500
      err.message = '주문 상태 변경 실패'
      return next(err)
   }
})

module.exports = router
