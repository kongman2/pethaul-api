// scripts/add-surveyResult-column.js
// pets 테이블에 surveyResult 컬럼 추가
const { sequelize } = require('../models')

async function addSurveyResultColumn() {
   try {
      console.log('🔧 pets 테이블에 surveyResult 컬럼 추가 중...')
      
      // MySQL/MariaDB용 ALTER TABLE 쿼리
      await sequelize.query(`
         ALTER TABLE pets 
         ADD COLUMN IF NOT EXISTS surveyResult JSON NULL 
         COMMENT '반려동물 설문조사 결과 데이터'
      `)
      
      console.log('✅ surveyResult 컬럼이 성공적으로 추가되었습니다!')
      process.exit(0)
   } catch (error) {
      console.error('❌ 마이그레이션 실패:', error)
      
      // IF NOT EXISTS가 지원되지 않는 경우 (MySQL 5.7 이하)
      if (error.message.includes('syntax') || error.message.includes('IF NOT EXISTS')) {
         console.log('🔄 IF NOT EXISTS 구문을 제거하고 재시도합니다...')
         try {
            await sequelize.query(`
               ALTER TABLE pets 
               ADD COLUMN surveyResult JSON NULL 
               COMMENT '반려동물 설문조사 결과 데이터'
            `)
            console.log('✅ surveyResult 컬럼이 성공적으로 추가되었습니다!')
            process.exit(0)
         } catch (retryError) {
            if (retryError.message.includes('Duplicate column')) {
               console.log('ℹ️  surveyResult 컬럼이 이미 존재합니다.')
               process.exit(0)
            }
            console.error('❌ 재시도 실패:', retryError)
            process.exit(1)
         }
      } else if (error.message.includes('Duplicate column')) {
         console.log('ℹ️  surveyResult 컬럼이 이미 존재합니다.')
         process.exit(0)
      }
      
      process.exit(1)
   }
}

// 실행
addSurveyResultColumn()

