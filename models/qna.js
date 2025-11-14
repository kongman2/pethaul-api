// modules/qna.js
const Sequelize = require('sequelize')

module.exports = class Qna extends Sequelize.Model {
   static init(sequelize) {
      return super.init(
         {
            title: {
               type: Sequelize.STRING(200),
               allowNull: false,
               defaultValue: '문의 드립니다.',
            },
            content: {
               type: Sequelize.TEXT,
               allowNull: false,
            },
            comment: {
               type: Sequelize.TEXT,
               allowNull: true,
               defaultValue: null,
            },
            itemId: {
               type: Sequelize.INTEGER,
               allowNull: true,
               comment: '상품 문의인 경우 상품 ID',
            },
            isPrivate: {
               type: Sequelize.BOOLEAN,
               allowNull: false,
               defaultValue: false,
               comment: '비공개 여부',
            },
         },
         {
            sequelize,
            timestamps: true, // createdAt, updatedAt
            underscored: false,
            modelName: 'Qna',
            tableName: 'qna',
            paranoid: false, // deletedAt 미사용
            charset: 'utf8mb4',
            collate: 'utf8mb4_general_ci',
         }
      )
   }
   static associate(db) {
      Qna.belongsTo(db.User, {
         foreignKey: 'userId',
         targetKey: 'id',
         onDelete: 'CASCADE',
      })
      Qna.belongsTo(db.Item, {
         foreignKey: 'itemId',
         targetKey: 'id',
         onDelete: 'CASCADE',
      })
   }
}
