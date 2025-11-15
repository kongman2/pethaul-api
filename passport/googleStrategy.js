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
   
   passport.use(
      new GoogleStrategy(
         {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: callbackURL,
         },
         async (accessToken, refreshToken, profile, done) => {
            try {
               // 프로필 정보 검증
               if (!profile || !profile.emails || !profile.emails[0] || !profile.emails[0].value) {
                  const error = new Error('Google 프로필에서 이메일 정보를 가져올 수 없습니다.')
                  console.error('❌ Google OAuth 프로필 오류:', error.message, { profile })
                  return done(error)
               }

               const email = profile.emails[0].value
               console.log('🔍 Google OAuth 프로필 확인:', { email, displayName: profile.displayName, id: profile.id })

               const exUser = await User.findOne({
                  where: { email },
               })

               if (exUser) {
                  // 이미 존재하는 유저면 로그인 처리
                  console.log('✅ 기존 사용자 로그인:', { userId: exUser.id, email: exUser.email })
                  done(null, exUser)
               } else {
                  // 새로 가입 처리
                  console.log('📝 새 사용자 생성:', { email, displayName: profile.displayName })
                  const newUser = await User.create({
                     userId: `google_${profile.id}`,
                     name: profile.displayName || 'Google User',
                     email: email,
                     password: null, // 소셜 로그인은 패스워드 없음
                     provider: 'google',
                  })
                  console.log('✅ 새 사용자 생성 완료:', { userId: newUser.id, email: newUser.email })
                  done(null, newUser)
               }
            } catch (error) {
               console.error('❌ Google OAuth Strategy 오류:', {
                  message: error.message,
                  stack: error.stack,
                  name: error.name,
               })
               done(error)
            }
         }
      )
   )
}
