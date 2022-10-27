const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const User = require('./models/user');
const authMiddleware = require('./middlewares/auth-middleware');

mongoose.connect('mongodb://localhost/shopping-demo', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));

const app = express();
const router = express.Router();

// 회원가입

const PostUsersSchema = Joi.object({
  nickname: Joi.string().required(),
  eamil: Joi.string().email().required(),
  password: Joi.string().required(),
  confirmPassword: Joi.string().required(),
});

router.post('/users', async (req, res, next) => {
  try {
    const { nickname, email, password, confirmPassword } =
      await PostUsersSchema.validateAsync(req.body);

    if (password !== confirmPassword) {
      res
        .status(400)
        .json({ errorMessage: '비밀번호와 비밀번호 확인이 동일하지 않음' });
      return;
    }

    const checkUsers = await User.find({
      $or: [{ email }, { nickname }], // $or 로 email도 nickname도 데이터베이스에 있는지 확인하는 것
    });
    if (checkUsers.length) {
      // 유저정보가 겹치는것이 있는지 이야기 하는데, 어떤것이 있는건지 확실하게 알려주지 않기위해서 (해커위험)
      res
        .status(400)
        .json({ errorMessage: '이미 가입된 이메일 또는 닉네임이 있습니다.' });
      return;
    }

    const user = new User({ email, nickname, password });
    user.save();
    res.status(201).send({});
  } catch (error) {
    res.status(400).send({
      errorMessage: '요청한 데이터형식이 올바르지 않습니다.',
    });
  }
});

// 로그인

const PostLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

router.post('/auth', async (req, res, next) => {
  try {
    const { email, password } = await PostLoginSchema.validateAsync(req.body);

    const user = await User.findOne({ email, password }).exec(); // email과 password 둘다 일치하는게 있는지 확인하는것

    if (!user) {
      res
        .status(400)
        .json({ errorMessage: '이메일 또는 패스워드가 잘못됐습니다' });
      return;
    }

    const token = jwt.sign({ userID: user.userId }, 'my-secret-key');
    res.json({ token });
  } catch (error) {
    res.status(400).send({
      errorMessage: '요청한 데이터형식이 올바르지 않습니다.',
    });
  }
});

router.get('/users/me', authMiddleware, async (req, res, next) => {
  const { user } = res.locals;
  res.send({
    user: { nicename: user.nickname, email: user.email },
  });
});

app.use('/api', express.urlencoded({ extended: false }), router);
app.use(express.static('assets'));

app.listen(8080, () => {
  console.log('서버가 요청을 받을 준비가 됐어요');
});
