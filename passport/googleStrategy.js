const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const User = require('../models/user')

module.exports = () => {
   // 프로덕션에서는 절대 URL 사용, 개발 환경에서는 절대 URL 사용 (Google OAuth 요구사항)
   let callbackURL = process.env.GOOGLE_CALLBACK_URL
   
   if (!callbackURL) {
      if (process.env.NODE_ENV === 'production') {
         // 프로덕션: Render.com URL 사용
         callbackURL = `${process.env.API_URL || 'https://pethaul-api.onrender.com'}/auth/google/callback`
      } else {
         // 개발 환경: localhost URL 사용 (Google OAuth 콘솔에 등록 필요)
         const port = process.env.PORT || 8002
         callbackURL = `http://localhost:${port}/auth/google/callback`
      }
   }
   
   console.log('🔐 Google OAuth Callback URL:', callbackURL)
   console.log('🔐 Google OAuth Client ID:', process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 10)}...` : '미설정')
   console.log('🔐 Google OAuth Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? '설정됨' : '미설정')
   
   if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('❌ Google OAuth 환경 변수가 설정되지 않았습니다.')
      return
   }
   
   passport.use(
      new GoogleStrategy(
         {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: callbackURL,
            // Google OAuth 요청 옵션
            passReqToCallback: false,
         },
         async (accessToken, refreshToken, profile, done) => {
            try {
               console.log('🔍 Google OAuth Strategy 콜백 시작:', {
                  hasAccessToken: !!accessToken,
                  hasRefreshToken: !!refreshToken,
                  hasProfile: !!profile,
                  profileId: profile?.id,
                  profileEmail: profile?.emails?.[0]?.value,
                  profileDisplayName: profile?.displayName,
               })
               
               // 프로필 정보 검증
               if (!profile || !profile.emails || !profile.emails[0] || !profile.emails[0].value) {
                  const error = new Error('Google 프로필에서 이메일 정보를 가져올 수 없습니다.')
                  console.error('❌ Google OAuth 프로필 오류:', error.message, { 
                     profile: profile ? {
                        id: profile.id,
                        displayName: profile.displayName,
                        emails: profile.emails,
                        hasEmails: !!profile.emails,
                        emailsLength: profile.emails?.length,
                     } : null,
                  })
                  return done(error)
               }

               const email = profile.emails[0].value
               console.log('✅ Google OAuth 프로필 확인 완료:', { 
                  email, 
                  displayName: profile.displayName, 
                  id: profile.id,
                  provider: profile.provider,
               })

               // 사용자 조회 또는 생성
               let user = await User.findOne({
                  where: { email },
               })

               if (user) {
                  // 이미 존재하는 유저면 로그인 처리
                  console.log('✅ 기존 사용자 로그인:', { userId: user.id, email: user.email, provider: user.provider })
                  
                  // provider가 다르면 업데이트 (예: local -> google)
                  if (user.provider !== 'google') {
                     console.log('🔄 사용자 provider 업데이트:', { from: user.provider, to: 'google' })
                     await user.update({ provider: 'google' })
                     user = await User.findOne({ where: { id: user.id } })
                  }
                  
                  done(null, user)
               } else {
                  // 새로 가입 처리
                  console.log('📝 새 사용자 생성 시작:', { email, displayName: profile.displayName })
                  
                  // userId 생성 (중복 방지)
                  let userId = `google_${profile.id}`
                  let existingUserWithId = await User.findOne({ where: { userId } })
                  let counter = 1
                  while (existingUserWithId) {
                     userId = `google_${profile.id}_${counter}`
                     existingUserWithId = await User.findOne({ where: { userId } })
                     counter++
                  }
                  
                  const newUser = await User.create({
                     userId: userId,
                     name: profile.displayName || profile.name?.givenName || 'Google User',
                     email: email,
                     password: null, // 소셜 로그인은 패스워드 없음
                     provider: 'google',
                  })
                  console.log('✅ 새 사용자 생성 완료:', { userId: newUser.id, email: newUser.email, provider: newUser.provider })
                  done(null, newUser)
               }
            } catch (error) {
               console.error('❌ Google OAuth Strategy 오류:', {
                  message: error.message,
                  stack: error.stack,
                  name: error.name,
                  code: error.code,
                  statusCode: error.statusCode,
               })
               done(error)
            }
         }
      )
   )
   
   // Google Strategy 에러 핸들러 추가 (passport.use는 함수를 반환하지 않으므로 제거)
   // 대신 Strategy 내부에서 에러를 처리합니다
}
