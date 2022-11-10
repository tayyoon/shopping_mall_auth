const express = require('express');
const { Op } = require('sequelize');
const jwt = require('jsonwebtoken');
const { User, Cart, Goods } = require('./models');
const authMiddleware = require('./middlewares/auth-middleware');

const Http = require('http');
const socketIo = require('socket.io');

const app = express();
const http = Http.createServer(app);
const io = socketIo(http);
const router = express.Router();

const socketIdMap = {};
// key: socket.id , value: url 이 들어있을것임

function emitSamePageViewerCount() {
  const countByUrl = Object.values(socketIdMap).reduce((value, url) => {
    return { ...value, [url]: value[url] ? (value[url] = 1) : 1 };
  }, {}); // value쪽만 배열로 쭉 뽑아준다 = url만 쭉 있다.
  // reduce에 대해서 공부를 할 필요가 무조건!!!!

  for (const [socketId, url] of Object.entries(socketIdMap)) {
    const count = countByUrl[url];

    io.to(socketId).emit('SAME_PAGE_VIEWER_COUNT', count);
  }
}

io.on('connection', (socket) => {
  socketIdMap[socket.id] = null;
  console.log('누군가 연결 되었어용'),
    socket.emit('SAME_PAGE_VIEWER_COUNT', 99);

  socketIdMap.on('CHANGED_PAGE', (date) => {
    console.log('페이지가 바뀌었데요', data, socket.id);
    socketIdMap[socket.id] = data;
    emitSamePageViewerCount();
  });

  socket.on('BUY', (date) => {
    const payload = {
      nickname: data.nickname,
      goodsId: data.goodsId,
      goodsName: data.goodaName,
      date: new Date().toISOString(),
    };
    console.log('클라이언트가 구매한 데이터', data, new Date());

    io.emit('BUY_GOODS', payload); // io는 모든 소캣을 관리해주는 관리자 느낌? 전체를 관리하는 느낌
    io.emit('CLICK_GOODS', payload); // io는 모든 소캣을 관리해주는 관리자 느낌? 전체를 관리하는 느낌

    socket.broadcast.emit('BUY_GOODS', payload); // socket.broadcast.emit는 나를 제외한 모든 사람에게 알림을 보낸다!
  });

  socket.on('disconnect', () => {
    delete socketIdMap[socket.id];
    console.log('누군가 연결이 끊어졌어요');
    emitSamePageViewerCount();
  });
});

// cors는 요청하는 서버가 나와 도메인이 다를 때 혹은 호스트가 다를대 동작하는데 지금은 assetk일을 static미들웨어를 통해서 express를 통해서 제공하고 있기 때문에 스파르타 쇼핑몰은 내 서버고 내 서버에 socket io를 연결하는 개념이기 때문에 지금은 cors 가 필요가 없다.

router.post('/users', async (req, res) => {
  const { nickname, email, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    res.status(400).send({
      errorMessage: '패스워드가 패스워드 확인란과 동일하지 않습니다.',
    });
    return;
  }

  const existUsers = await User.findAll({
    where: {
      [Op.or]: [{ nickname }, { email }],
    },
  });
  if (existUsers.length) {
    res.status(400).send({
      errorMessage: '이미 가입된 이메일 또는 닉네임이 있습니다.',
    });
    return;
  }

  await User.create({ email, nickname, password });

  res.status(201).send({});
});

router.post('/auth', async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ where: { email, password } });

  if (!user) {
    res.status(400).send({
      errorMessage: '이메일 또는 패스워드가 잘못됐습니다.',
    });
    return;
  }

  const token = jwt.sign({ userId: user.userId }, 'my-secret-key');
  res.send({
    token,
  });
});

router.get('/users/me', authMiddleware, async (req, res) => {
  const { user } = res.locals;
  res.send({
    user,
  });
});

/**
 * 내가 가진 장바구니 목록을 전부 불러온다.
 */
router.get('/goods/cart', authMiddleware, async (req, res) => {
  const { userId } = res.locals.user;

  const cart = await Cart.findAll({
    where: {
      userId,
    },
  });

  const goodsIds = cart.map((c) => c.goodsId);

  // 루프 줄이기 위해 Mapping 가능한 객체로 만든것
  const goodsKeyById = await Goods.findAll({
    where: {
      goodsId: goodsIds,
    },
  }).then((goods) =>
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
    where: {
      userId,
      goodsId,
    },
  });

  if (existsCart) {
    existsCart.quantity = quantity;
    await existsCart.save();
  } else {
    await Cart.create({
      userId,
      goodsId,
      quantity,
    });
  }

  // NOTE: 성공했을때 응답 값을 클라이언트가 사용하지 않는다.
  res.send({});
});

/**
 * 장바구니 항목 삭제
 */
router.delete('/goods/:goodsId/cart', authMiddleware, async (req, res) => {
  const { userId } = res.locals.user;
  const { goodsId } = req.params;

  const existsCart = await Cart.findOne({
    where: {
      userId,
      goodsId,
    },
  });

  // 있든 말든 신경 안쓴다. 그냥 있으면 지운다.
  if (existsCart) {
    await existsCart.destroy();
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
  const goods = await Goods.findAll({
    order: [['goodsId', 'DESC']],
    where: category ? { category } : undefined,
  });

  res.send({ goods });
});

/**
 * 상품 하나만 가져오기
 */
router.get('/goods/:goodsId', authMiddleware, async (req, res) => {
  const { goodsId } = req.params;
  const goods = await Goods.findByPk(goodsId);

  if (!goods) {
    res.status(404).send({});
  } else {
    res.send({ goods });
  }
});

app.use('/api', express.urlencoded({ extended: false }), router);
app.use(express.static('assets'));

http.listen(8080, () => {
  console.log('서버가 요청을 받을 준비가 됐어요');
});
