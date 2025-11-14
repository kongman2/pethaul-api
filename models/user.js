// modules/user.js
const Sequelize = require('sequelize')

module.exports = class User extends Sequelize.Model {
   static init(sequelize) {
      return super.init(
         {
            userId: {
               type: Sequelize.STRING(255),
               allowNull: false,
               unique: true,
            },
            name: {
               type: Sequelize.STRING(255),
               allowNull: false,
            },
            password: {
               type: Sequelize.STRING(255),
               allowNull: true,
            },
            address: {
               type: Sequelize.STRING(255),
               allowNull: true,
            },
            addressDetail: {
               type: Sequelize.STRING(255),
               allowNull: true,
            },
            gender: {
               type: Sequelize.CHAR(1),
               allowNull: true,
               validate: {
                  isIn: [['F', 'M']],
               },
            },
            role: {
               type: Sequelize.ENUM('ADMIN', 'USER'),
               allowNull: false,
               defaultValue: 'USER',
            },
            phoneNumber: {
               type: Sequelize.STRING(20),
               allowNull: true, // 새로 추가된 필드이므로 기존 데이터에 NULL 값이 들어갈 수 있음
            },
            email: {
               type: Sequelize.STRING(100),
               allowNull: true,
               unique: true, // 이메일 중복 방지 (선택 사항)
               validate: {
                  isEmail: true, // Sequelize 내장 이메일 정규식 검증
               },
            },
            provider: {
               type: Sequelize.ENUM('local', 'google'), // ENUM 타입으로 지정
               allowNull: false,
               defaultValue: 'local', // 기본값은 local로 설정
            },
            tempPasswordExpiresAt: {
               type: Sequelize.DATE,
               allowNull: true,
               comment: '임시 비밀번호 만료 시간',
            },
            defaultDeliveryName: {
               type: Sequelize.STRING(255),
               allowNull: true,
               comment: '기본 배송지 수령인 이름',
            },
            defaultDeliveryPhone: {
               type: Sequelize.STRING(20),
               allowNull: true,
               comment: '기본 배송지 연락처',
            },
            defaultDeliveryAddress: {
               type: Sequelize.STRING(255),
               allowNull: true,
               comment: '기본 배송지 주소',
            },
            defaultDeliveryRequest: {
               type: Sequelize.STRING(255),
               allowNull: true,
               comment: '기본 배송 요청 사항',
            },
            defaultDeliveryAddressDetail: {
               type: Sequelize.STRING(255),
               allowNull: true,
               comment: '기본 배송지 상세 주소',
            },
         },
         {
            sequelize,
            timestamps: true, // createdAt, updatedAt
            underscored: false,
            modelName: 'User',
            tableName: 'users',
            paranoid: false, // deletedAt 사용 안 함
            charset: 'utf8mb4',
            collate: 'utf8mb4_general_ci',
         }
      )
   }

   static associate(db) {
      // 연관 관계 정의
      User.hasMany(db.Domain, { foreignKey: 'userId', sourceKey: 'id', onDelete: 'CASCADE' })
      User.hasMany(db.Order, { foreignKey: 'userId', sourceKey: 'id', onDelete: 'CASCADE' })
      User.hasOne(db.Cart, { foreignKey: 'userId', sourceKey: 'id', onDelete: 'CASCADE' })
      User.hasMany(db.Review, { foreignKey: 'userId', sourceKey: 'id', onDelete: 'CASCADE' })
      User.hasMany(db.Pet, { foreignKey: 'userId', sourceKey: 'id', onDelete: 'CASCADE' })
      User.hasMany(db.Like, { foreignKey: 'userId', sourceKey: 'id', onDelete: 'CASCADE' })
      User.hasMany(db.Content, { foreignKey: 'authorId', sourceKey: 'id', onDelete: 'SET NULL', onUpdate: 'CASCADE' })
      User.hasMany(db.Qna, { foreignKey: 'userId', sourceKey: 'id', onDelete: 'CASCADE' })
      User.hasMany(db.ExchangeReturn, { foreignKey: 'userId', sourceKey: 'id', onDelete: 'CASCADE' })
   }
}
