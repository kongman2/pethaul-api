// routes/item.js
const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { Item, ItemImage, Category, ItemCategory, Review, ReviewImage, User, Order, OrderItem, SearchKeyword, sequelize } = require('../models')
const { isAdmin, verifyToken, isLoggedIn } = require('./middlewares')
const { Op, col, fn } = require('sequelize')

const router = express.Router()

// uploads 폴더가 없을 경우 새로 생성
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
         const decodedFileName = decodeURIComponent(file.originalname)
         const ext = path.extname(decodedFileName)
         const basename = path.basename(decodedFileName, ext)
         cb(null, basename + Date.now() + ext)
      },
   }),
   limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
})

/**
 * 1. 상품 등록
 */
router.post('/', verifyToken, isAdmin, upload.array('img'), async (req, res, next) => {
   try {
      if (!req.files) {
         const error = new Error('파일 업로드에 실패했습니다.')
         error.status = 400
         return next(error)
      }

      const { itemNm, price, stockNumber, itemDetail, itemSellStatus, itemSummary, discountPercent } = req.body

      let categories = []
      try {
         categories = JSON.parse(req.body.categories)
      } catch (err) {
         const error = new Error('카테고리 파싱에 실패했습니다.')
         error.status = 400
         return next(error)
      }

      const item = await Item.create({
         itemNm,
         price,
         stockNumber,
         itemDetail,
         itemSellStatus,
         itemSummary,
         discountPercent: discountPercent ? parseInt(discountPercent, 10) : 0,
      })

      // 이미지 insert
      const images = req.files.map((file) => ({
         oriImgName: file.originalname,
         imgUrl: `/uploads/${file.filename}`,
         repImgYn: 'N',
         itemId: item.id,
      }))
      if (images.length > 0) images[0].repImgYn = 'Y'
      await ItemImage.bulkCreate(images)

      // 카테고리 저장 및 연결
      const categoryInstances = await Promise.all(
         categories.map(async (data) => {
            const [category] = await Category.findOrCreate({ where: { categoryName: data.trim() } })
            return category
         })
      )

      const itemCategories = categoryInstances.map((category) => ({
         itemId: item.id,
         categoryId: category.id,
      }))
      await ItemCategory.bulkCreate(itemCategories)

      return res.status(201).json({
         success: true,
         message: '상품이 성공적으로 등록되었습니다.',
         item,
         images,
         categories: categoryInstances.map((c) => c.categoryName),
      })
   } catch (error) {
      error.status = error.status || 500
      error.message = error.message || '상품 등록 중 오류가 발생했습니다.'
      return next(error)
   }
})

/**
 * 2. 전체 상품 불러오기 (공개)
 */
router.get('/', async (req, res, next) => {
   try {
      const page = parseInt(req.query.page, 10) || 1
      const limit = parseInt(req.query.limit, 10) || 10
      const offset = (page - 1) * limit

      const searchTerm = req.query.searchTerm || ''
      let sellCategory = req.query.sellCategory ?? req.query['sellCategory[]'] ?? null

      // URL 디코딩 처리 및 정규화
      if (sellCategory) {
         if (Array.isArray(sellCategory)) {
            // 배열의 각 요소 디코딩
            sellCategory = sellCategory
               .filter(Boolean)
               .map(cat => {
                  if (typeof cat === 'string') {
                     try {
                        return decodeURIComponent(cat)
                     } catch (e) {
                        console.warn('sellCategory 배열 요소 디코딩 실패:', e.message, cat)
                        return cat
                     }
                  }
                  return cat
               })
               .filter(Boolean) // 빈 문자열 제거
         } else if (typeof sellCategory === 'string') {
            try {
               sellCategory = decodeURIComponent(sellCategory)
               // 쉼표로 구분된 값 처리
               if (sellCategory.includes(',')) {
                  sellCategory = sellCategory.split(',').map(cat => cat.trim()).filter(Boolean)
               } else {
                  sellCategory = [sellCategory]
               }
            } catch (e) {
               console.warn('sellCategory 디코딩 실패:', e.message, sellCategory)
               // 디코딩 실패 시 원본을 배열로 변환
               sellCategory = sellCategory.includes(',') 
                  ? sellCategory.split(',').map(cat => cat.trim()).filter(Boolean)
                  : [sellCategory]
            }
         } else {
            sellCategory = null
         }
         
         // 빈 배열이면 null로 설정
         if (Array.isArray(sellCategory) && sellCategory.length === 0) {
            sellCategory = null
         }
      } else {
         sellCategory = null
      }
      
      console.log('🔍 sellCategory 처리 결과:', { 
         original: req.query.sellCategory, 
         processed: sellCategory,
         type: typeof sellCategory,
         isArray: Array.isArray(sellCategory)
      })

      const whereClause = {
         ...(searchTerm && { itemNm: { [Op.like]: `%${searchTerm}%` } }),
      }

      // Category 필터링이 있는 경우 ItemCategory를 통해 필터링
      let categoryFilter = null
      if (sellCategory && Array.isArray(sellCategory) && sellCategory.length > 0) {
         // Category에서 해당 카테고리 이름들로 ID 찾기
         const categories = await Category.findAll({
            where: { categoryName: { [Op.in]: sellCategory } },
            attributes: ['id']
         })
         
         if (categories.length > 0) {
            const categoryIds = categories.map(cat => cat.id)
            categoryFilter = {
               model: ItemCategory,
               where: { categoryId: { [Op.in]: categoryIds } },
               required: true, // INNER JOIN으로 필터링
               attributes: []
            }
         } else {
            // 카테고리가 존재하지 않으면 빈 결과 반환
            return res.json({
               success: true,
               message: '상품 목록 조회 성공',
               items: [],
               pagination: {
                  totalItems: 0,
                  totalPages: 0,
                  currentPage: page,
                  limit,
               },
            })
         }
      }

      const includeModels = [
         { model: ItemImage, attributes: ['id', 'oriImgName', 'imgUrl', 'repImgYn'] },
         {
            model: Category,
            attributes: ['id', 'categoryName'],
            through: { attributes: [] },
            required: false,
         },
         ...(categoryFilter ? [categoryFilter] : []),
      ]

      // 전체 상품 갯수
      const countOptions = {
         where: whereClause,
         ...(categoryFilter && {
            include: [categoryFilter],
            distinct: true, // 중복 제거
         }),
      }
      const count = await Item.count(countOptions)

      const items = await Item.findAll({
         where: whereClause,
         limit,
         offset,
         order: [['createdAt', 'DESC']],
         include: includeModels,
         ...(categoryFilter && { distinct: true }), // 중복 제거
      })

      // 검색어가 있으면 검색어 기록 (비동기로 처리하여 응답 지연 방지)
      if (searchTerm && searchTerm.trim()) {
         const trimmedKeyword = searchTerm.trim()
         SearchKeyword.findOrCreate({
            where: { keyword: trimmedKeyword },
            defaults: { keyword: trimmedKeyword, searchCount: 1 },
         })
            .then(([keyword, created]) => {
               if (!created) {
                  // 기존 검색어면 카운트 증가
                  keyword.increment('searchCount')
               }
            })
            .catch((err) => {
            })
      }

      return res.json({
         success: true,
         message: '상품 목록 조회 성공',
         items,
         pagination: {
            totalItems: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            limit,
         },
      })
   } catch (error) {
      error.status = error.status || 500
      error.message = '상품 목록 불러오기 실패'
      return next(error)
   }
})

/**
 * 3. 메인 페이지용 상품 불러오기
 */
router.get('/all/main', async (req, res, next) => {
   const limit = Number(req.query.limit) || 5

   const today = new Date()
   today.setHours(0, 0, 0, 0)
   const todayISOString = today.toISOString().slice(0, 19).replace('T', ' ')

   try {
      const [topSalesResult, topTodayResult, newItemsResult] = await Promise.allSettled([
         Item.findAll({
            attributes: [
               'id',
               'itemNm',
               'price',
               'itemSellStatus',
               [
                  sequelize.literal(`(
                     SELECT COALESCE(SUM(oi.count), 0)
                     FROM orderItems AS oi
                     WHERE oi.itemId = Item.id
                  )`),
                  'sellCount',
               ],
            ],
            include: [
               {
                  model: ItemImage,
                  attributes: ['imgUrl'],
                  where: { repImgYn: 'Y' },
                  required: false,
                  separate: true,
                  limit: 1,
               },
               {
                  model: Category,
                  attributes: ['categoryName'],
                  through: { attributes: [] },
                  required: false,
               },
            ],
            order: [[sequelize.literal('sellCount'), 'DESC']],
            limit,
         }),
         Item.findAll({
            attributes: [
               'id',
               'itemNm',
               'price',
               'itemSellStatus',
               [
                  sequelize.literal(`(
                     SELECT COUNT(*)
                     FROM orderItems AS oi
                     INNER JOIN orders AS o ON o.id = oi.orderId
                     WHERE oi.itemId = Item.id
                     AND o.orderDate >= '${todayISOString}'
                  )`),
                  'orderCount',
               ],
            ],
            include: [
               {
                  model: ItemImage,
                  attributes: ['imgUrl'],
                  where: { repImgYn: 'Y' },
                  required: false,
                  separate: true,
                  limit: 1,
               },
               {
                  model: Category,
                  attributes: ['categoryName'],
                  through: { attributes: [] },
                  required: false,
               },
            ],
            order: [[sequelize.literal('orderCount'), 'DESC']],
            limit,
         }),
         Item.findAll({
            attributes: ['id', 'itemNm', 'price', 'itemSellStatus'],
            include: [
         { 
            model: ItemImage, 
                  attributes: ['imgUrl'],
                  required: false,
                  separate: true,
                  limit: 1,
         },
         {
            model: Category,
                  attributes: ['categoryName'],
         },
            ],
         order: [['createdAt', 'DESC']],
            limit,
         }),
      ])

      const responsePayload = {
         success: true,
         message: '메인 상품 목록 조회 성공',
         topSales: topSalesResult.status === 'fulfilled' ? topSalesResult.value : [],
         topToday: topTodayResult.status === 'fulfilled' ? topTodayResult.value : [],
         newItems: newItemsResult.status === 'fulfilled' ? newItemsResult.value : [],
      }

      const errors = []
      if (topSalesResult.status === 'rejected') {
         errors.push({ section: 'topSales', message: topSalesResult.reason?.message })
      }
      if (topTodayResult.status === 'rejected') {
         errors.push({ section: 'topToday', message: topTodayResult.reason?.message })
      }
      if (newItemsResult.status === 'rejected') {
         errors.push({ section: 'newItems', message: newItemsResult.reason?.message })
      }

      if (errors.length > 0) {
         responsePayload.partialErrors = errors
      }

      return res.json(responsePayload)
   } catch (error) {
      error.status = error.status || 500
      error.message = '메인 상품 목록 불러오기 실패'
      return next(error)
   }
})

/**
 * 인기 검색어 조회 (동적 라우트 /:id 보다 먼저 정의해야 함)
 */
router.get('/popular-keywords', async (req, res, next) => {
   try {
      const limit = parseInt(req.query.limit, 10) || 4

      // SearchKeyword 모델이 없을 경우 빈 배열 반환
      let keywords = []
      try {
         keywords = await SearchKeyword.findAll({
         order: [['searchCount', 'DESC'], ['updatedAt', 'DESC']],
         limit,
         attributes: ['keyword', 'searchCount'],
      })
      } catch (dbError) {
         // 데이터베이스 오류 시 빈 배열 반환 (서버 크래시 방지)
         console.error('인기 검색어 조회 DB 오류:', dbError.message)
         keywords = []
      }

      return res.json({
         success: true,
         message: '인기 검색어 조회 성공',
         keywords: keywords.map((k) => k.keyword),
      })
   } catch (error) {
      // 에러 발생 시에도 CORS 헤더 보장
      const origin = req.headers.origin
      if (origin) {
         res.setHeader('Access-Control-Allow-Origin', origin)
         res.setHeader('Access-Control-Allow-Credentials', 'true')
      }
      
      error.status = error.status || 500
      error.message = '인기 검색어 불러오기 실패'
      return next(error)
   }
})

/**
 * 4. 특정 상품 불러오기 (공개)
 */
router.get('/:id', async (req, res, next) => {
   try {
      const item = await Item.findOne({
         where: { id: req.params.id },
         include: [
            { model: ItemImage, attributes: ['id', 'oriImgName', 'imgUrl', 'repImgYn'] },
            { model: Category, attributes: ['id', 'categoryName'] },
            {
               model: Review,
               attributes: ['id', 'reviewDate', 'reviewContent', 'rating'],
               include: [
                  { model: ReviewImage, attributes: ['id', 'oriImgName', 'imgUrl'] },
                  { model: User, attributes: ['id', 'userId', 'name'] },
               ],
            },
         ],
      })

      if (!item) {
         const error = new Error('해당 상품을 찾을 수 없습니다.')
         error.status = 404
         return next(error)
      }

      return res.json({ success: true, message: '상품 조회 성공', item })
   } catch (error) {
      error.status = error.status || 500
      error.message = '상품 조회 실패'
      return next(error)
   }
})

/**
 * 5. 상품 수정
 */
router.put('/:id', verifyToken, isAdmin, upload.array('img'), async (req, res, next) => {
   try {
      const { itemNm, price, stockNumber, itemDetail, itemSellStatus, categories } = req.body

      let parsedCategories = []
      try {
         parsedCategories = JSON.parse(categories)
      } catch (err) {
         const error = new Error('카테고리 파싱에 실패했습니다.')
         error.status = 400
         return next(error)
      }

      const item = await Item.findByPk(req.params.id)
      if (!item) {
         const error = new Error('해당 상품을 찾을 수 없습니다.')
         error.status = 404
         return next(error)
      }

      await item.update({ 
         itemNm, 
         price, 
         stockNumber, 
         itemDetail, 
         itemSellStatus,
         discountPercent: discountPercent ? parseInt(discountPercent, 10) : 0,
      })

      if (req.files && req.files.length > 0) {
         await ItemImage.destroy({ where: { itemId: item.id } })
         const images = req.files.map((file) => ({
            oriImgName: file.originalname,
            imgUrl: `/uploads/${file.filename}`,
            repImgYn: 'N',
            itemId: item.id,
         }))
         if (images.length > 0) images[0].repImgYn = 'Y'
         await ItemImage.bulkCreate(images)
      }

      await ItemCategory.destroy({ where: { itemId: item.id } })

      const categoryInstances = await Promise.all(
         parsedCategories.map(async (data) => {
            const [category] = await Category.findOrCreate({ where: { categoryName: data.trim() } })
            return category
         })
      )

      const itemCategories = categoryInstances.map((category) => ({ itemId: item.id, categoryId: category.id }))
      await ItemCategory.bulkCreate(itemCategories)

      return res.json({ success: true, message: '상품이 성공적으로 수정되었습니다.' })
   } catch (error) {
      error.status = error.status || 500
      error.message = '상품 수정 실패'
      return next(error)
   }
})

/**
 * 6. 상품 삭제
 */
router.delete('/:id', verifyToken, isAdmin, async (req, res, next) => {
   try {
      const item = await Item.findByPk(req.params.id)
      if (!item) {
         const error = new Error('상품을 찾을 수 없습니다.')
         error.status = 404
         return next(error)
      }

      await item.destroy()
      return res.json({ success: true, message: '상품이 삭제되었습니다.' })
   } catch (error) {
      error.status = error.status || 500
      error.message = '상품 삭제 실패'
      return next(error)
   }
})

/**
 * 7. 추천 상품 조회
 */
router.post('/recommend', async (req, res, next) => {
   try {
      const { items } = req.body

      if (!items || items.length === 0) {
         return res.status(204).json({ message: '추천할 상품이 없습니다.' })
      }

      const result = await Item.findAll({
         where: { id: { [Op.in]: items } },
         include: [
            {
               model: ItemImage,
               where: { repImgYn: 'Y' },
               attributes: ['oriImgName', 'imgUrl'],
            },
         ],
      })

      return res.status(200).json({
         success: true,
         message: '추천 상품 조회에 성공했습니다.',
         result,
      })
   } catch (err) {
      return next(err)
   }
})

module.exports = router
