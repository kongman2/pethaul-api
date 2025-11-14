// models/index.js
const Sequelize = require('sequelize')
const env = process.env.NODE_ENV || 'development'
const config = require('../config/config')[env]

// 환경 변수 검증
if (!config.database || !config.username || !config.host) {
   if (env === 'production') {
      console.error('❌ 데이터베이스 설정이 누락되었습니다.')
      console.error('프로덕션 환경에서는 다음 환경 변수가 필요합니다:')
      console.error('  - DEPLOY_DB_USERNAME')
      console.error('  - DEPLOY_DB_PASSWORD')
      console.error('  - DEPLOY_DB_NAME')
      console.error('  - DEPLOY_DB_HOST')
      console.error('  - DEPLOY_DB_DIALECT (선택사항, 기본값: mysql)')
      console.error('현재 설정된 값:')
      console.error('  - DEPLOY_DB_USERNAME:', process.env.DEPLOY_DB_USERNAME ? '설정됨' : '❌ 미설정')
      console.error('  - DEPLOY_DB_PASSWORD:', process.env.DEPLOY_DB_PASSWORD ? '설정됨' : '❌ 미설정')
      console.error('  - DEPLOY_DB_NAME:', process.env.DEPLOY_DB_NAME || '❌ 미설정')
      console.error('  - DEPLOY_DB_HOST:', process.env.DEPLOY_DB_HOST || '❌ 미설정')
   } else {
      console.error('데이터베이스 설정이 누락되었습니다. 필요한 환경 변수: DB_NAME, DB_USERNAME, DB_HOST, DB_PASSWORD')
   }
}

const User = require('./user')
const Item = require('./item')
const Cart = require('./cart')
const CartItem = require('./cartItem')
const Category = require('./category')
const ItemCategory = require('./itemCategory')
const Order = require('./order')
const OrderItem = require('./orderItem')
const ItemImage = require('./itemImage')
const Review = require('./review')
const ReviewImage = require('./reviewImage')
const Pet = require('./pet')
const PetImage = require('./petImage')
const Domain = require('./domain')
const Like = require('./like')
const Content = require('./content')
const Qna = require('./qna')
const SearchKeyword = require('./searchKeyword')
const ExchangeReturn = require('./exchangeReturn')

const db = {}
const sequelize = new Sequelize(config.database, config.username, config.password, config)

db.sequelize = sequelize

// Expose models on db
/*
db.User = User
db.Item = Item
db.Cart = Cart
... 이하 동일
과 같은 역할
*/
Object.assign(db, {
   User,
   Item,
   Cart,
   CartItem,
   Category,
   ItemCategory,
   Order,
   OrderItem,
   ItemImage,
   Review,
   ReviewImage,
   Pet,
   PetImage,
   Domain,
   Like,
   Content,
   Qna,
   SearchKeyword,
   ExchangeReturn,
})

// Initialize
User.init(sequelize)
Item.init(sequelize)
Cart.init(sequelize)
CartItem.init(sequelize)
Category.init(sequelize)
ItemCategory.init(sequelize)
Order.init(sequelize)
OrderItem.init(sequelize)
ItemImage.init(sequelize)
Review.init(sequelize)
ReviewImage.init(sequelize)
Pet.init(sequelize)
PetImage.init(sequelize)
Domain.init(sequelize)
Like.init(sequelize)
Content.init(sequelize)
Qna.init(sequelize)
SearchKeyword.init(sequelize)
ExchangeReturn.init(sequelize)

// Associate
User.associate(db)
Item.associate(db)
Cart.associate(db)
CartItem.associate(db)
Category.associate(db)
ItemCategory.associate(db)
Order.associate(db)
OrderItem.associate(db)
ItemImage.associate(db)
Review.associate(db)
ReviewImage.associate(db)
Pet.associate(db)
PetImage.associate(db)
Domain.associate(db)
Like.associate(db)
Content.associate(db)
Qna.associate(db)
SearchKeyword.associate(db)
ExchangeReturn.associate(db)

module.exports = db
