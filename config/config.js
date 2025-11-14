require('dotenv').config() // .env 파일 로드

module.exports = {
   development: {
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      host: process.env.DB_HOST,
      dialect: process.env.DB_DIALECT || 'mysql',
      timezone: '+09:00', // KST로 설정
      dialectOptions: {
         // MySQL 연결 옵션
         connectTimeout: 60000,
         flags: ['-FOUND_ROWS'],
      },
      pool: {
         max: 5,
         min: 0,
         acquire: 30000,
         idle: 10000,
         // afterCreate: async (connection) => {
         //    try {
         //       await connection.query("SET SESSION max_allowed_packet = 67108864")
         //    } catch (err) {
         //       console.warn('⚠️ max_allowed_packet 설정 실패:', err.message)
         //    }
         // },
      },
      logging: false,
   },
   test: {
      username: process.env.TEST_DB_USERNAME,
      password: process.env.TEST_DB_PASSWORD,
      database: process.env.TEST_DB_NAME,
      host: process.env.TEST_DB_HOST,
      dialect: process.env.TEST_DB_DIALECT || 'mysql',
      timezone: '+09:00', // KST로 설정
      dialectOptions: {
         connectTimeout: 60000,
         flags: ['-FOUND_ROWS'],
      },
      pool: {
         max: 5,
         min: 0,
         acquire: 30000,
         idle: 10000,
      },
   },
   production: {
      username: process.env.DEPLOY_DB_USERNAME,
      password: process.env.DEPLOY_DB_PASSWORD,
      database: process.env.DEPLOY_DB_NAME,
      // 호스트와 포트 분리 처리
      host: (() => {
         const host = process.env.DEPLOY_DB_HOST || ''
         // 포트가 포함되어 있으면 분리
         if (host.includes(':')) {
            return host.split(':')[0]
         }
         return host
      })(),
      port: (() => {
         const host = process.env.DEPLOY_DB_HOST || ''
         // 포트가 포함되어 있으면 추출
         if (host.includes(':')) {
            const port = host.split(':')[1]
            return port ? parseInt(port, 10) : 3306
         }
         // 별도 포트 환경 변수 확인
         return process.env.DEPLOY_DB_PORT ? parseInt(process.env.DEPLOY_DB_PORT, 10) : 3306
      })(),
      dialect: process.env.DEPLOY_DB_DIALECT || 'mysql',
      logging: false, // 로그 숨기기
      timezone: '+09:00', // KST로 설정
      dialectOptions: {
         connectTimeout: 60000,
         flags: ['-FOUND_ROWS'],
      },
      pool: {
         max: 10,
         min: 2,
         acquire: 30000,
         idle: 10000,
      },
   },
}
