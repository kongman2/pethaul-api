// scripts/add-delivery-columns.js
const { sequelize } = require('../models')

async function addDeliveryColumns() {
  try {
    const columns = [
      { name: 'deliveryName', type: 'VARCHAR(255)', comment: '배송지 수령인 이름' },
      { name: 'deliveryPhone', type: 'VARCHAR(20)', comment: '배송지 연락처' },
      { name: 'deliveryAddress', type: 'VARCHAR(500)', comment: '배송지 주소' },
      { name: 'deliveryAddressDetail', type: 'VARCHAR(255)', comment: '배송지 상세 주소' },
      { name: 'deliveryRequest', type: 'VARCHAR(255)', comment: '배송 요청 사항' },
    ]

    for (const col of columns) {
      try {
        await sequelize.query(`
          ALTER TABLE orders
          ADD COLUMN ${col.name} ${col.type} NULL COMMENT '${col.comment}';
        `)
        console.log(`✅ ${col.name} 컬럼이 추가되었습니다.`)
      } catch (err) {
        if (err.message.includes('Duplicate column name')) {
          console.log(`ℹ️  ${col.name} 컬럼이 이미 존재합니다.`)
        } else {
          throw err
        }
      }
    }
    console.log('✅ 모든 배송지 컬럼 처리가 완료되었습니다.')
    process.exit(0)
  } catch (error) {
    console.error('❌ 배송지 컬럼 추가 실패:', error)
    process.exit(1)
  }
}

addDeliveryColumns()

