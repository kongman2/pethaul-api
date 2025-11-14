// scripts/add-ageInMonths-column.js
// pets 테이블에 ageInMonths 컬럼 추가
const { sequelize } = require('../models')

async function addAgeInMonthsColumn() {
   try {
      console.log('🔧 pets 테이블에 ageInMonths 컬럼 추가 중...')
      
      // MySQL/MariaDB용 ALTER TABLE 쿼리
      await sequelize.query(`
         ALTER TABLE pets 
         ADD COLUMN ageInMonths INT UNSIGNED NULL 
         COMMENT '1살 미만인 경우 개월 수 (1-11)'
         AFTER age
      `)
      
      console.log('✅ ageInMonths 컬럼이 성공적으로 추가되었습니다!')
      process.exit(0)
   } catch (error) {
      console.error('❌ 마이그레이션 실패:', error)
      
      if (error.message.includes('Duplicate column')) {
         console.log('ℹ️  ageInMonths 컬럼이 이미 존재합니다.')
         process.exit(0)
      }
      
      process.exit(1)
   }
}

// 실행
addAgeInMonthsColumn()

