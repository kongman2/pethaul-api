const Sequelize = require('sequelize')

module.exports = class Item extends Sequelize.Model {
   static init(sequelize) {
      return super.init(
         {
            itemNm: {
               type: Sequelize.STRING(50),
               allowNull: false,
            },
            price: {
               type: Sequelize.INTEGER,
               allowNull: false,
            },
            itemSummary: {
               type: Sequelize.STRING(1500),
               allowNull: true,
            },
            itemDetail: {
               type: Sequelize.TEXT,
               allowNull: true,
            },
            itemSellStatus: {
               type: Sequelize.ENUM('SELL', 'SOLD_OUT'),
               allowNull: false,
            },
            stockNumber: {
               type: Sequelize.INTEGER,
               allowNull: false,
            },
            discountPercent: {
               type: Sequelize.INTEGER,
               allowNull: true,
               defaultValue: 0,
               comment: '할인율 (%)',
            },
         },
         {
            sequelize,
            timestamps: true,
            underscored: false,
            modelName: 'Item',
            tableName: 'items',
            paranoid: false,
            charset: 'utf8mb4',
            collate: 'utf8mb4_general_ci',
         }
      )
   }
   static associate(db) {
      Item.hasMany(db.ItemImage, {
         foreignKey: 'itemId',
         sourceKey: 'id',
         onDelete: 'CASCADE',
      })

      Item.hasMany(db.OrderItem, {
         foreignKey: 'itemId',
         sourceKey: 'id',
         onDelete: 'CASCADE',
      })
      Item.hasMany(db.CartItem, {
         foreignKey: 'itemId',
         sourceKey: 'id',
         onDelete: 'CASCADE',
      })
      Item.hasMany(db.Review, {
         foreignKey: 'itemId',
         sourceKey: 'id',
         onDelete: 'CASCADE',
      })

      // 교차테이블 관계 설정
      Item.belongsToMany(db.Cart, {
         through: db.CartItem,
         foreignKey: 'itemId',
         otherKey: 'cartId',
      })
      Item.belongsToMany(db.Category, {
         through: db.ItemCategory,
         foreignKey: 'itemId',
         otherKey: 'categoryId',
      })
      Item.belongsToMany(db.Order, {
         through: db.OrderItem,
         foreignKey: 'itemId',
         otherKey: 'orderId',
         as: 'Orders',
      })
      Item.hasMany(db.Like, { foreignKey: 'itemId', sourceKey: 'id', onDelete: 'CASCADE' })
      Item.hasMany(db.Qna, { foreignKey: 'itemId', sourceKey: 'id', onDelete: 'CASCADE' })
   }
}
