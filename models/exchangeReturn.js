const Sequelize = require('sequelize')

module.exports = class ExchangeReturn extends Sequelize.Model {
   static init(sequelize) {
      return super.init(
         {
            type: {
               type: Sequelize.ENUM('EXCHANGE', 'RETURN'),
               allowNull: false,
               comment: '교환/반품 구분',
            },
            reason: {
               type: Sequelize.TEXT,
               allowNull: false,
               comment: '교환/반품 사유',
            },
            status: {
               type: Sequelize.ENUM('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'),
               allowNull: false,
               defaultValue: 'PENDING',
               comment: '처리 상태: 대기, 승인, 거부, 완료',
            },
            adminComment: {
               type: Sequelize.TEXT,
               allowNull: true,
               comment: '관리자 답변',
            },
         },
         {
            sequelize,
            timestamps: true,
            underscored: false,
            modelName: 'ExchangeReturn',
            tableName: 'exchange_returns',
            paranoid: false,
            charset: 'utf8mb4',
            collate: 'utf8mb4_general_ci',
         }
      )
   }
   static associate(db) {
      ExchangeReturn.belongsTo(db.Order, {
         foreignKey: 'orderId',
         targetKey: 'id',
         onDelete: 'CASCADE',
      })
      ExchangeReturn.belongsTo(db.User, {
         foreignKey: 'userId',
         targetKey: 'id',
         onDelete: 'CASCADE',
      })
   }
}

