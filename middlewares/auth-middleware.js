const jwt = require('jsonwebtoken');
const User = require('../models/user');

module.exports = (req, res, next) => {
  const { authorization } = req.headers;
  const [tokenType, tokenValue] = authorization.split(' '); // []도 디스트럭쳐링 가능(첫번째가 토큰타입, 두번째가 토큰벨류), 공백을 기준으로 잘라서 배열로 반환해줌

  if (tokenType !== 'Bearer') {
    res.status(401).json({ errorMessage: '로그인 후 사용하세요' });
    return;
  }

  try {
    // const decoded = jwt.verify(tokenValue, 'my-secret-key'); // 디코디드 된것이 유효하게 나오면 제대로 된 토큰인 것이다.
    // { userID: '6351611f8ffbfd72e92aeb47', iat: 1666281033 } 이런식으로 나와서 디스트럭처링 또 가능함
    const { userId } = jwt.verify(tokenValue, 'my-secret-key');

    User.findOne(userId) // async사요잉 아니어서 promies then()을 사용한 것임 exec()때문에!!
      .exec()
      .then((user) => {
        res.locals.user = user;
        next();
      }); //findOne 이랑 findById랑 동일하다고 보면 된당
  } catch (error) {
    res.status(401).json({ errorMessage: '로그인 후 사용하세요' });
    return;
  }
  //   next(); //  미들웨어는 무조건 호출되어야함, 뒤쪽 미들웨어로 진행될 수가 없음, 하지만 위쪽 try의 경우에만 next가 실행되도록 위로 올려줌
};
