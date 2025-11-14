// src/scripts/add-purchase-confirmed-column.js
const { sequelize } = require('../models')

async function addPurchaseConfirmedColumn() {
  try {
    await sequelize.query(`
      ALTER TABLE orders
      ADD COLUMN isPurchaseConfirmed BOOLEAN NOT NULL DEFAULT FALSE COMMENT '구매 확정 여부';
    `)
    console.log('✅ orders 테이블에 isPurchaseConfirmed 컬럼이 성공적으로 추가되었습니다.')
  } catch (error) {
    if (error.message.includes('Duplicate column name')) {
      console.log('ℹ️  isPurchaseConfirmed 컬럼이 이미 존재합니다.')
    } else {
      console.error('❌ orders 테이블 컬럼 추가 실패:', error)
    }
  } finally {
    await sequelize.close()
  }
}

addPurchaseConfirmedColumn()

