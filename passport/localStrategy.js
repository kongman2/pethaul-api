const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcrypt')
const User = require('../models/user')

module.exports = () => {
   passport.use(
      new LocalStrategy(
         {
            usernameField: 'userId',
            passwordField: 'password',
         },

         async (userId, password, done) => {
            try {
               // 사용자가 제공한 userId로 DB에서 유저 찾기
               const exUser = await User.findOne({ where: { userId } })

               if (exUser) {
                  // 비밀번호 비교
                  const result = await bcrypt.compare(password, exUser.password)

                  if (result) {
                     // 로그인 성공 시 user 정보를 done()을 통해 세션에 저장
                     // 세션에 유저 정보를 저장하여, 이후 요청에서 세션을 통해 로그인 상태를 확인할 수 있게 됩니다.
                     // 세션 저장
                     return done(null, exUser)
                  } else {
                     // 비밀번호가 틀린 경우
                     return done(null, false, { message: '비밀번호가 일치하지 않습니다.' })
                  }
               } else {
                  // 가입되지 않은 사용자
                  return done(null, false, { message: '가입되지 않은 회원입니다.' })
               }
            } catch (error) {
               // 에러 처리 시 쿠키 관련 오류를 기록하고, 클라이언트에 적절한 메시지 전달
               if (error.name === 'SequelizeConnectionError') {
                  return done(null, false, { message: '데이터베이스 연결 오류' })
               }
               return done(error)
            }
         }
      )
   )
}
