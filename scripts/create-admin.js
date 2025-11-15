// scripts/create-admin.js
// 관리자 계정 생성 스크립트
require('dotenv').config()
const bcrypt = require('bcrypt')

// 프로덕션 환경 변수 확인
const env = process.env.NODE_ENV || 'production'
if (env === 'production') {
   console.log('📋 프로덕션 환경 변수 확인:')
   console.log('  DEPLOY_DB_USERNAME:', process.env.DEPLOY_DB_USERNAME ? '✅ 설정됨' : '❌ 미설정')
   console.log('  DEPLOY_DB_PASSWORD:', process.env.DEPLOY_DB_PASSWORD ? '✅ 설정됨' : '❌ 미설정')
   console.log('  DEPLOY_DB_NAME:', process.env.DEPLOY_DB_NAME || '❌ 미설정')
   console.log('  DEPLOY_DB_HOST:', process.env.DEPLOY_DB_HOST || '❌ 미설정')
   console.log('')
}

const { User } = require('../models')

async function createAdmin() {
   try {
      // 환경 변수에서 관리자 정보 가져오기 (없으면 기본값 사용)
      const adminUserId = process.env.ADMIN_USER_ID || 'admin'
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123!'
      const adminName = process.env.ADMIN_NAME || '관리자'
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@pethaul.com'

      // 기존 관리자 계정 확인
      const existingAdmin = await User.findOne({ where: { userId: adminUserId } })
      
      if (existingAdmin) {
         // 이미 존재하는 경우 role만 업데이트
         if (existingAdmin.role !== 'ADMIN') {
            await existingAdmin.update({ role: 'ADMIN' })
            console.log(`✅ 기존 사용자 '${adminUserId}'의 권한을 관리자로 변경했습니다.`)
         } else {
            console.log(`ℹ️  관리자 계정 '${adminUserId}'가 이미 존재합니다.`)
         }
         
         // 비밀번호 업데이트 여부 확인
         if (process.env.ADMIN_PASSWORD) {
            const hashedPassword = await bcrypt.hash(adminPassword, 10)
            await existingAdmin.update({ password: hashedPassword })
            console.log(`✅ 관리자 계정 비밀번호를 업데이트했습니다.`)
         }
         
         return
      }

      // 새 관리자 계정 생성
      const hashedPassword = await bcrypt.hash(adminPassword, 10)
      
      await User.create({
         userId: adminUserId,
         name: adminName,
         email: adminEmail,
         password: hashedPassword,
         role: 'ADMIN',
         provider: 'local',
      })

      console.log('✅ 관리자 계정이 생성되었습니다.')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('📋 관리자 로그인 정보:')
      console.log(`   ID: ${adminUserId}`)
      console.log(`   비밀번호: ${adminPassword}`)
      console.log(`   이메일: ${adminEmail}`)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('⚠️  보안을 위해 로그인 후 비밀번호를 변경하세요!')
      
   } catch (error) {
      console.error('❌ 관리자 계정 생성 실패:', error.message)
      process.exit(1)
   } finally {
      process.exit(0)
   }
}

createAdmin()

