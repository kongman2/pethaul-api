// routes/content.js
const express = require('express')
const { Op } = require('sequelize')
const { Content, User } = require('../models')
const { isAdmin, verifyToken } = require('./middlewares')
const multer = require('multer')
const path = require('path')
const fs = require('fs')

const router = express.Router()

// ---------- uploads dir (absolute) ----------
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads')
try {
   if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })
} catch (e) {
}

const storage = multer.diskStorage({
   destination(req, file, cb) {
      cb(null, UPLOAD_DIR)
   },
   filename(req, file, cb) {
      try {
         const decoded = decodeURIComponent(file.originalname)
         const ext = path.extname(decoded)
         const basename = path.basename(decoded, ext)
         const safeBase = basename.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]+/g, '') || 'upload'
         cb(null, `${safeBase}-${Date.now()}${ext}`)
      } catch {
         const ext = path.extname(file.originalname || '')
         cb(null, `upload-${Date.now()}${ext}`)
      }
   },
})
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })

// ---------- utils ----------
function getBaseUrl(req) {
   if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '')
   const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http'
   const host = req.get('host')
   return `${proto}://${host}`
}

// Join descriptor for author (no alias unless your model uses one)
const AUTHOR_INCLUDE = {
   model: User,
   attributes: ['id', 'userId', 'name', 'email', 'role'],
   required: false,
}

// ---------- GET /contents ----------
router.get('/', async (req, res, next) => {
   try {
      const pageRaw = parseInt(`${req.query.page || 1}`, 10)
      const sizeRaw = parseInt(`${req.query.size || 10}`, 10)
      const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1
      const size = Number.isFinite(sizeRaw) ? Math.min(Math.max(sizeRaw, 1), 50) : 10

      // 관리자 체크 (req.user가 있고 role이 ADMIN인 경우)
      const isAdmin = req.user && (req.user.role === 'ADMIN' || req.user.role === 'admin')
      
      const where = {}
      
      // status 필터: 관리자는 all/published/draft 선택 가능, 일반 사용자는 published만
      const statusParam = (req.query.status || '').trim()
      if (isAdmin) {
         if (statusParam === 'published' || statusParam === 'draft') {
            where.status = statusParam
         }
         // status가 'all'이거나 없으면 where에 status 조건을 추가하지 않음 (모든 상태 조회)
      } else {
         where.status = 'published' // 일반 사용자는 항상 published만
      }

      const tag = (req.query.tag || '').trim()
      if (tag) where.tag = tag

      const q = (req.query.q || '').trim()
      if (q) {
         where[Op.or] = [{ title: { [Op.like]: `%${q}%` } }, { summary: { [Op.like]: `%${q}%` } }]
      }

      const offset = (page - 1) * size
      const { rows, count } = await Content.findAndCountAll({
         where,
         include: [AUTHOR_INCLUDE],
         order: [
            ['isFeatured', 'DESC'],
            ['publishedAt', 'DESC'],
            ['createdAt', 'DESC'],
         ],
         limit: size,
         offset,
      })

      res.json({ list: rows, page, size, total: count, hasMore: page * size < count })
   } catch (err) {
      next(err)
   }
})

// ---------- GET /contents/:id ----------
router.get('/:id', async (req, res, next) => {
   try {
      const row = await Content.findByPk(req.params.id, { include: [AUTHOR_INCLUDE] })
      if (!row || row.status !== 'published') return res.status(404).json({ message: 'Not found' })
      res.json(row)
   } catch (err) {
      next(err)
   }
})

// ---------- GET /contents/slug/:slug ----------
router.get('/slug/:slug', async (req, res, next) => {
   try {
      const slug = `${req.params.slug}`
      const row = await Content.findOne({ where: { slug, status: 'published' }, include: [AUTHOR_INCLUDE] })
      if (!row) return res.status(404).json({ message: 'Not found' })
      res.json(row)
   } catch (err) {
      next(err)
   }
})

// ---------- POST /contents (admin) ----------
router.post('/', verifyToken, isAdmin, async (req, res, next) => {
   try {
      const payload = req.body || {}

      const status = payload.status === 'draft' ? 'draft' : 'published'
      const publishedAt = status === 'published' ? payload.publishedAt || new Date() : null

      // author auto-fill
      const authorId = Number.isFinite(+payload.authorId) ? +payload.authorId : req.user?.id ?? null
      const author = (payload.author && `${payload.author}`.trim()) || req.user?.name || null

      const row = await Content.create({
         ...payload,
         authorId,
         author,
         status,
         publishedAt,
      })

      res.status(201).json(row)
   } catch (err) {
      next(err)
   }
})

// ---------- PUT /contents/:id (admin) ----------
router.put('/:id', verifyToken, isAdmin, async (req, res, next) => {
   try {
      const row = await Content.findByPk(req.params.id)
      if (!row) return res.status(404).json({ message: 'Not found' })

      const payload = req.body || {}
      const status = payload.status === 'draft' ? 'draft' : payload.status === 'published' ? 'published' : row.status
      const publishedAt = status === 'published' ? payload.publishedAt || row.publishedAt || new Date() : null

      const authorId = payload.authorId !== undefined ? (Number.isFinite(+payload.authorId) ? +payload.authorId : null) : row.authorId ?? req.user?.id ?? null

      const author = (payload.author && `${payload.author}`.trim()) || row.author || req.user?.name || null

      await row.update({ ...payload, authorId, author, status, publishedAt })
      res.json(row)
   } catch (err) {
      next(err)
   }
})

// ---------- DELETE /contents/:id (admin) ----------
router.delete('/:id', verifyToken, isAdmin, async (req, res, next) => {
   try {
      const row = await Content.findByPk(req.params.id)
      if (!row) return res.status(404).json({ message: 'Not found' })
      await row.destroy()
      res.json({ ok: true })
   } catch (err) {
      next(err)
   }
})

// ---------- POST /contents/images (admin) ----------
// returns { url } for use as coverUrl/thumbUrl on create/update
router.post('/images', verifyToken, isAdmin, upload.single('image'), (req, res, next) => {
   try {
      if (!req.file) return res.status(400).json({ message: 'No file uploaded' })
      const base = getBaseUrl(req)
      const url = `${base}/uploads/${encodeURIComponent(req.file.filename)}`
      res.status(201).json({ url })
   } catch (err) {
      next(err)
   }
})

module.exports = router
