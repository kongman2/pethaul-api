// scripts/add-address-detail-columns.js
// users 테이블에 상세 주소 관련 컬럼 추가

const { sequelize } = require('../models')

async function addAddressDetailColumns() {
   try {
      console.log('🔧 users 테이블에 상세 주소 컬럼 추가 중...')

      await sequelize.query(`
         ALTER TABLE users
         ADD COLUMN addressDetail VARCHAR(255) NULL COMMENT '회원 상세 주소' AFTER address,
         ADD COLUMN defaultDeliveryAddressDetail VARCHAR(255) NULL COMMENT '기본 배송지 상세 주소' AFTER defaultDeliveryAddress
      `)

      console.log('✅ 상세 주소 컬럼이 성공적으로 추가되었습니다!')
      process.exit(0)
   } catch (error) {
      console.error('❌ 마이그레이션 실패:', error)
      if (error.message.includes('Duplicate column')) {
         console.log('ℹ️  상세 주소 관련 컬럼이 이미 존재합니다.')
         process.exit(0)
      }
      process.exit(1)
   }
}

addAddressDetailColumns()

