// routes/pet.js
const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { sequelize, Pet, PetImage } = require('../models')
const { authenticateToken } = require('./middlewares')

const router = express.Router()

// 📌 한글 파일명 복구 함수
function decodeOriginalName(raw) {
   const utf8 = Buffer.from(raw, 'latin1').toString('utf8')
   if (/%[0-9A-Fa-f]{2}/.test(utf8)) {
      try {
         return decodeURIComponent(utf8)
      } catch {
         /* ignore */
      }
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
         const decoded = decodeOriginalName(file.originalname)
         const ext = path.extname(decoded)
         const basename = path.basename(decoded, ext)
         cb(null, basename + Date.now() + ext)
      },
   }),
   limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
})

/** 펫 등록 (이미지 포함)
 * [POST] /
 * form-data: petName, petType, breed, gender, age, surveyResult, (files) img[]
 */
router.post('/', authenticateToken, upload.array('img'), async (req, res, next) => {
   const t = await sequelize.transaction()
   try {
      const { petName, petType, breed, gender, surveyResult, ageInMonths } = req.body
      const age = Number(req.body.age ?? 0)

      if (!petName || !petType) {
         await t.rollback()
         const error = new Error('필수 값이 누락되었습니다. (petName, petType)')
         error.status = 400
         return next(error)
      }

      // 설문조사 결과 파싱 (JSON 문자열인 경우)
      let parsedSurveyResult = null
      if (surveyResult) {
         try {
            parsedSurveyResult = typeof surveyResult === 'string' ? JSON.parse(surveyResult) : surveyResult
         } catch (e) {
         }
      }

      // 1) 펫 생성
      const pet = await Pet.create(
         { 
            userId: req.user.id, 
            petName, 
            petType, 
            breed, 
            gender, 
            age,
            ageInMonths: ageInMonths ? Number(ageInMonths) : null,
            surveyResult: parsedSurveyResult
         }, 
         { transaction: t }
      )

      // 2) 이미지 저장
      let petImages = []
      if (Array.isArray(req.files) && req.files.length > 0) {
         petImages = req.files.map((file) => ({
            oriImgName: decodeOriginalName(file.originalname),
            imgUrl: `/${file.filename}`,
            petId: pet.id,
         }))
         await PetImage.bulkCreate(petImages, { transaction: t })
      }

      await t.commit()
      return res.status(201).json({
         success: true,
         message: '펫이 성공적으로 등록되었습니다.',
         pet,
         petImages,
      })
   } catch (error) {
      await t.rollback()
      error.status = error.status || 500
      error.message = error.message || '펫 등록 중 오류가 발생했습니다.'
      return next(error)
   }
})

/** 펫 수정 (이미지 재업로드 시 기존 이미지 전부 교체)
 * [PUT] /edit/:id
 * form-data 가능(이미지 교체 시 img[] 포함)
 */
router.put('/edit/:id', authenticateToken, upload.array('img'), async (req, res, next) => {
   try {
      const { petName, petType, breed, gender, surveyResult, ageInMonths } = req.body
      const age = Number(req.body.age ?? 0)

      const pet = await Pet.findByPk(req.params.id)
      if (!pet) {
         const error = new Error('해당 펫을 찾을 수 없습니다.')
         error.status = 404
         return next(error)
      }
      if (pet.userId !== req.user.id) {
         const error = new Error('권한이 없습니다.')
         error.status = 403
         return next(error)
      }

      // 설문조사 결과 파싱 (JSON 문자열인 경우)
      let parsedSurveyResult = pet.surveyResult // 기존 값 유지
      if (surveyResult !== undefined) {
         try {
            parsedSurveyResult = typeof surveyResult === 'string' ? JSON.parse(surveyResult) : surveyResult
         } catch (e) {
         }
      }

      await pet.update({ 
         petName, 
         petType, 
         breed, 
         gender, 
         age, 
         ageInMonths: ageInMonths !== undefined ? (ageInMonths ? Number(ageInMonths) : null) : pet.ageInMonths,
         surveyResult: parsedSurveyResult 
      })

      // 파일이 올라오면 기존 이미지 교체
      if (Array.isArray(req.files) && req.files.length > 0) {
         await PetImage.destroy({ where: { petId: pet.id } })
         const petImages = req.files.map((file) => ({
            oriImgName: decodeOriginalName(file.originalname),
            imgUrl: `/${file.filename}`,
            petId: pet.id,
         }))
         await PetImage.bulkCreate(petImages)
      }

      return res.json({
         success: true,
         message: '펫 정보를 성공적으로 수정했습니다.',
      })
   } catch (error) {
      error.status = error.status || 500
      error.message = error.message || '펫 수정 중 오류가 발생했습니다.'
      return next(error)
   }
})

/** 펫 삭제
 * [DELETE] /:id
 */
router.delete('/:id', authenticateToken, async (req, res, next) => {
   try {
      const pet = await Pet.findByPk(req.params.id)
      if (!pet) {
         const error = new Error('해당 펫을 찾을 수 없습니다.')
         error.status = 404
         return next(error)
      }
      if (pet.userId !== req.user.id) {
         const error = new Error('권한이 없습니다.')
         error.status = 403
         return next(error)
      }

      await pet.destroy()
      return res.status(200).json({ success: true, message: '펫이 삭제되었습니다.' })
   } catch (error) {
      error.status = error.status || 500
      error.message = error.message || '펫 삭제 중 오류가 발생했습니다.'
      return next(error)
   }
})

/** 회원이 등록한 펫 목록 조회 (이미지 포함)
 * [GET] /
 */
router.get('/', authenticateToken, async (req, res, next) => {
   try {
      const pets = await Pet.findAll({
         where: { userId: req.user.id },
         include: [
            {
               model: PetImage,
               as: 'images',
               attributes: ['id', 'oriImgName', 'imgUrl'],
               separate: true,
            },
         ],
         order: [['createdAt', 'DESC']],
      })

      return res.status(200).json({
         success: true,
         message: '회원이 등록한 펫 목록을 성공적으로 불러왔습니다.',
         pets,
      })
   } catch (error) {
      error.status = error.status || 500
      error.message = error.message || '데이터를 불러오는 중 오류가 발생했습니다.'
      return next(error)
   }
})

module.exports = router
