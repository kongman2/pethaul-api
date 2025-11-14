// scripts/add-default-delivery-columns.js
// users 테이블에 기본 배송지 관련 컬럼 추가
const { sequelize } = require('../models')

async function addDefaultDeliveryColumns() {
   try {
      console.log('🔧 users 테이블에 기본 배송지 컬럼 추가 중...')

      await sequelize.query(`
         ALTER TABLE users
         ADD COLUMN defaultDeliveryName VARCHAR(255) NULL COMMENT '기본 배송지 수령인 이름' AFTER tempPasswordExpiresAt,
         ADD COLUMN defaultDeliveryPhone VARCHAR(20) NULL COMMENT '기본 배송지 연락처' AFTER defaultDeliveryName,
         ADD COLUMN defaultDeliveryAddress VARCHAR(255) NULL COMMENT '기본 배송지 주소' AFTER defaultDeliveryPhone,
         ADD COLUMN defaultDeliveryRequest VARCHAR(255) NULL COMMENT '기본 배송 요청 사항' AFTER defaultDeliveryAddress
      `)

      console.log('✅ 기본 배송지 컬럼이 성공적으로 추가되었습니다!')
      process.exit(0)
   } catch (error) {
      console.error('❌ 마이그레이션 실패:', error)

      if (error.message.includes('Duplicate column')) {
         console.log('ℹ️  기본 배송지 관련 컬럼이 이미 존재합니다.')
         process.exit(0)
      }

      process.exit(1)
   }
}

addDefaultDeliveryColumns()

