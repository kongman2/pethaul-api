const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const User = require('../models/user')

module.exports = () => {
   passport.use(
      new GoogleStrategy(
         {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: '/auth/google/callback',
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
