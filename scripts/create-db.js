// scripts/create-db.js
// 데이터베이스 생성 스크립트
require('dotenv').config()
const mysql = require('mysql2/promise')

async function createDatabase() {
   const connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
   })

   const dbName = process.env.DB_NAME || 'petshop'

   try {
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`)
      console.log(`✅ 데이터베이스 '${dbName}' 생성 완료 (또는 이미 존재함)`)
   } catch (error) {
      console.error(`❌ 데이터베이스 생성 실패:`, error.message)
      process.exit(1)
   } finally {
      await connection.end()
   }
}

createDatabase()

