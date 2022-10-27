const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const User = require('./models/user');
const Goods = require('./models/goods');
const Cart = require('./models/cart');
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

/**
 * 내가 가진 장바구니 목록을 전부 불러온다.
 */
router.get('/goods/cart', authMiddleware, async (req, res) => {
  const { userId } = res.locals.user;

  const cart = await Cart.find({
    userId,
  }).exec();

  const goodsIds = cart.map((c) => c.goodsId);

  // 루프 줄이기 위해 Mapping 가능한 객체로 만든것
  const goodsKeyById = await Goods.find({
    where: {
      goodsId: goodsIds,
    },
  })
    .exec()
    .then((goods) =>
      goods.reduce(
        (prev, g) => ({
          ...prev,
          [g.goodsId]: g,
        }),
        {},
      ),
    );

  res.send({
    cart: cart.map((c) => ({
      quantity: c.quantity,
      goods: goodsKeyById[c.goodsId],
    })),
  });
});

/**
 * 장바구니에 상품 담기.
 * 장바구니에 상품이 이미 담겨있으면 갯수만 수정한다.
 */
router.put('/goods/:goodsId/cart', authMiddleware, async (req, res) => {
  const { userId } = res.locals.user;
  const { goodsId } = req.params;
  const { quantity } = req.body;

  const existsCart = await Cart.findOne({
    userId,
    goodsId,
  }).exec();

  if (existsCart) {
    existsCart.quantity = quantity;
    await existsCart.save();
  } else {
    const cart = new Cart({
      userId,
      goodsId,
      quantity,
    });
    await cart.save();
  }

  // NOTE: 성공했을때 딱히 정해진 응답 값이 없다.
  res.send({});
});

/**
 * 장바구니 항목 삭제
 */
router.delete('/goods/:goodsId/cart', authMiddleware, async (req, res) => {
  const { userId } = res.locals.user;
  const { goodsId } = req.params;

  const existsCart = await Cart.findOne({
    userId,
    goodsId,
  }).exec();

  // 있든 말든 신경 안쓴다. 그냥 있으면 지운다.
  if (existsCart) {
    await existsCart.delete().exec();
  }

  // NOTE: 성공했을때 딱히 정해진 응답 값이 없다.
  res.send({});
});

/**
 * 모든 상품 가져오기
 * 상품도 몇개 없는 우리에겐 페이지네이션은 사치다.
 * @example
 * /api/goods
 * /api/goods?category=drink
 * /api/goods?category=drink2
 */
router.get('/goods', authMiddleware, async (req, res) => {
  const { category } = req.query;
  const goods = await Goods.find(category ? { category } : undefined)
    .sort('-date')
    .exec();

  res.send({ goods });
});

/**
 * 상품 하나만 가져오기
 */
router.get('/goods/:goodsId', authMiddleware, async (req, res) => {
  const { goodsId } = req.params;
  const goods = await Goods.findById(goodsId).exec();

  if (!goods) {
    res.status(404).send({});
  } else {
    res.send({ goods });
  }
});

app.use('/api', express.urlencoded({ extended: false }), router);
app.use(express.static('assets'));

app.listen(8080, () => {
  console.log('서버가 요청을 받을 준비가 됐어요');
});
