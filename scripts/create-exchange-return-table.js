const { sequelize } = require('../models')

async function createExchangeReturnTable() {
   try {
      await sequelize.query(`
         CREATE TABLE IF NOT EXISTS exchange_returns (
            id INT AUTO_INCREMENT PRIMARY KEY,
            orderId INT NOT NULL,
            userId INT NOT NULL,
            type ENUM('EXCHANGE', 'RETURN') NOT NULL COMMENT '교환/반품 구분',
            reason TEXT NOT NULL COMMENT '교환/반품 사유',
            status ENUM('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED') NOT NULL DEFAULT 'PENDING' COMMENT '처리 상태',
            adminComment TEXT NULL COMMENT '관리자 답변',
            createdAt DATETIME NOT NULL,
            updatedAt DATETIME NOT NULL,
            FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_orderId (orderId),
            INDEX idx_userId (userId),
            INDEX idx_status (status)
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `)
      console.log('✅ exchange_returns 테이블이 생성되었습니다.')
      process.exit(0)
   } catch (error) {
      console.error('❌ exchange_returns 테이블 생성 실패:', error)
      process.exit(1)
   }
}

createExchangeReturnTable()

