const { sequelize } = require('../models')

async function addItemInquiryColumns() {
   try {
      // itemId 컬럼 추가
      try {
         await sequelize.query(`
            ALTER TABLE qna 
            ADD COLUMN itemId INT NULL COMMENT '상품 문의인 경우 상품 ID',
            ADD COLUMN isPrivate BOOLEAN NOT NULL DEFAULT FALSE COMMENT '비공개 여부';
         `)
         console.log('✅ itemId, isPrivate 컬럼이 추가되었습니다.')
      } catch (err) {
         if (err.message.includes('Duplicate column name')) {
            console.log('ℹ️  itemId 또는 isPrivate 컬럼이 이미 존재합니다.')
         } else {
            throw err
         }
      }

      // 외래키 추가
      try {
         await sequelize.query(`
            ALTER TABLE qna 
            ADD CONSTRAINT fk_qna_itemId 
            FOREIGN KEY (itemId) REFERENCES items(id) 
            ON DELETE CASCADE;
         `)
         console.log('✅ itemId 외래키가 추가되었습니다.')
      } catch (err) {
         if (err.message.includes('Duplicate foreign key')) {
            console.log('ℹ️  itemId 외래키가 이미 존재합니다.')
         } else {
            throw err
         }
      }

      console.log('✅ 모든 상품 문의 컬럼 처리가 완료되었습니다.')
      process.exit(0)
   } catch (error) {
      console.error('❌ 상품 문의 컬럼 추가 실패:', error)
      process.exit(1)
   }
}

addItemInquiryColumns()

