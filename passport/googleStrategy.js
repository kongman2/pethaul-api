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
               const exUser = await User.findOne({
                  where: { email: profile.emails[0].value },
               })

               if (exUser) {
                  // 이미 존재하는 유저면 로그인 처리
                  done(null, exUser)
               } else {
                  // 새로 가입 처리
                  const newUser = await User.create({
                     userId: `google_${profile.id}`,
                     name: profile.displayName,
                     email: profile.emails[0].value,
                     password: null, // 소셜 로그인은 패스워드 없음
                     provider: 'google',
                  })
                  done(null, newUser)
               }
            } catch (error) {
               done(error)
            }
         }
      )
   )
}
