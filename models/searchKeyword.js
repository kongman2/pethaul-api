const Sequelize = require('sequelize')

module.exports = class SearchKeyword extends Sequelize.Model {
   static init(sequelize) {
      return super.init(
         {
            keyword: {
               type: Sequelize.STRING(100),
               allowNull: false,
            },
            searchCount: {
               type: Sequelize.INTEGER,
               allowNull: false,
               defaultValue: 1,
            },
         },
         {
            sequelize,
            timestamps: true,
            underscored: false,
            modelName: 'SearchKeyword',
            tableName: 'search_keywords',
            paranoid: false,
            charset: 'utf8mb4',
            collate: 'utf8mb4_general_ci',
            indexes: [
               { fields: ['keyword'] },
               { fields: ['searchCount'] },
               { fields: ['updatedAt'] },
            ],
         }
      )
   }

   static associate(db) {
      // 필요시 User와의 관계 추가 가능
   }
}

