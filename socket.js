const socketIo = require('socket.io')
const http = require('./app')

const io = socketIo(http)

function initSocket(sock) {
    console.log('새로운 소켓이 연결됐어요!')

    // 특정 이벤트가 전달됐는지 감지할 때 사용될 함수
    function watchEvent(event, func) {
        sock.on(event, func)
    }

    // 연결된 모든 클라이언트에 데이터를 보낼때 사용될 함수
    function notifyEveryone(event, data) {
        io.emit(event, data)
    }

    return {
        watchBuying: () => {
            watchEvent('BUY', (data) => {
                const emitData = {
                    ...data,
                    date: new Date().toISOString(),
                }
                notifyEveryone('BUY_GOODS', emitData)
            })
        },

        watchByebye: () => {
            watchEvent('disconnect', () => {
                console.log(sock.id, '연결이 끊어졌어요!')
            })
        },
    }
}

const socketIdMap = {}
// key: socket.id , value: url 이 들어있을것임

function emitSamePageViewerCount() {
    const countByUrl = Object.values(socketIdMap).reduce((value, url) => {
        return { ...value, [url]: value[url] ? (value[url] = 1) : 1 }
    }, {}) // value쪽만 배열로 쭉 뽑아준다 = url만 쭉 있다.
    // reduce에 대해서 공부를 할 필요가 무조건!!!!

    for (const [socketId, url] of Object.entries(socketIdMap)) {
        const count = countByUrl[url]

        io.to(socketId).emit('SAME_PAGE_VIEWER_COUNT', count)
    }
}

io.on('connection', (socket) => {
    socketIdMap[socket.id] = null
    const { watchBuying, watchByebye } = initSocket(socket)
    socket.emit('SAME_PAGE_VIEWER_COUNT', 99)

    socketIdMap.on('CHANGED_PAGE', (date) => {
        console.log('페이지가 바뀌었데요', data, socket.id)
        socketIdMap[socket.id] = data
        emitSamePageViewerCount()
    })

    // socket.on('BUY', (date) => {
    //     const payload = {
    //         nickname: data.nickname,
    //         goodsId: data.goodsId,
    //         goodsName: data.goodaName,
    //         date: new Date().toISOString(),
    //     }
    //     console.log('클라이언트가 구매한 데이터', data, new Date())

    // io.emit('BUY_GOODS', payload) // io는 모든 소캣을 관리해주는 관리자 느낌? 전체를 관리하는 느낌

    // socket.broadcast.emit('BUY_GOODS', payload) // socket.broadcast.emit는 나를 제외한 모든 사람에게 알림을 보낸다!

    watchBuying()
    watchByebye()
})

// socket.on('disconnect', () => {
//     delete socketIdMap[socket.id]
//     console.log('누군가 연결이 끊어졌어요')
//     emitSamePageViewerCount()
// })

// cors는 요청하는 서버가 나와 도메인이 다를 때 혹은 호스트가 다를대 동작하는데 지금은 assetk일을 static미들웨어를 통해서 express를 통해서 제공하고 있기 때문에 스파르타 쇼핑몰은 내 서버고 내 서버에 socket io를 연결하는 개념이기 때문에 지금은 cors 가 필요가 없다.
