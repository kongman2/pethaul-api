const express = require('express')
const router = express.Router()

// 헬스체크 엔드포인트 (Render 헬스체크용)
router.get('/', (req, res) => {
   res.status(200).json({
      success: true,
      message: 'Pethaul API is running',
      timestamp: new Date().toISOString(),
   })
})

module.exports = router
