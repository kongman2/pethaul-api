const Sequelize = require('sequelize')

module.exports = class Order extends Sequelize.Model {
   static init(sequelize) {
      return super.init(
         {
            orderDate: {
               type: Sequelize.DATE,
               allowNull: false,
            },
            orderStatus: {
               type: Sequelize.ENUM('ORDER', 'READY', 'SHIPPED', 'DELIVERED', 'CANCEL'),
               /* ORDER: 주문 
               READY: 배송 준비
               SHIPPED: 배송 중
               DELIVERED: 배송 완료
               CANCEL: 주문 취소
               */
               allowNull: false,
            },
            deliveryName: {
               type: Sequelize.STRING(255),
               allowNull: true,
               comment: '배송지 수령인 이름',
            },
            deliveryPhone: {
               type: Sequelize.STRING(20),
               allowNull: true,
               comment: '배송지 연락처',
            },
            deliveryAddress: {
               type: Sequelize.STRING(500),
               allowNull: true,
               comment: '배송지 주소',
            },
            deliveryAddressDetail: {
               type: Sequelize.STRING(255),
               allowNull: true,
               comment: '배송지 상세 주소',
            },
            deliveryRequest: {
               type: Sequelize.STRING(255),
               allowNull: true,
               comment: '배송 요청 사항',
            },
            isPurchaseConfirmed: {
               type: Sequelize.BOOLEAN,
               allowNull: false,
               defaultValue: false,
               comment: '구매 확정 여부',
            },
         },
         {
            sequelize,
            timestamps: true,
            underscored: false,
            modelName: 'Order',
            tableName: 'orders',
            paranoid: false,
            charset: 'utf8mb4',
            collate: 'utf8mb4_general_ci',
         }
      )
   }
   static associate(db) {
      Order.belongsTo(db.User, {
         foreignKey: 'userId',
         targetKey: 'id',
         onDelete: 'CASCADE',
      })
      Order.belongsToMany(db.Item, {
         through: db.OrderItem,
         foreignKey: 'orderId',
         otherKey: 'itemId',
      })
      Order.hasMany(db.ExchangeReturn, {
         foreignKey: 'orderId',
         sourceKey: 'id',
         onDelete: 'CASCADE',
      })
   }
}
