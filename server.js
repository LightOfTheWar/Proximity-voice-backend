const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")

const app = express()
app.use(cors())
app.use(express.json())

const server = http.createServer(app)
const io = new Server(server, { cors: { origin: "*" } })

const SECRET = "CHANGE_THIS_SECRET_KEY"

let positions = {}
let usernames = {}
let sockets = {}
let validTokens = {}

app.post("/register-token", (req, res) => {

    const { data, signature } = req.body
    if (!data || !signature) return res.sendStatus(400)

    if (signature !== SECRET + "_" + data.userId)
        return res.sendStatus(403)

    validTokens[data.userId] = {
        createdAt: Date.now()
    }

    res.sendStatus(200)
})

app.post("/update", (req, res) => {
    const { userId, username, x, y, z } = req.body
    positions[userId] = { x, y, z }
    usernames[userId] = username
    res.sendStatus(200)
})

io.on("connection", (socket) => {

    socket.on("register", ({ userId }) => {

        if (!validTokens[userId]) {
            socket.emit("forbidden", "Token invalide")
            socket.disconnect()
            return
        }

        if (Date.now() - validTokens[userId].createdAt > 30 * 60 * 1000) {
            delete validTokens[userId]
            socket.emit("forbidden", "Token expiré")
            socket.disconnect()
            return
        }

        socket.userId = userId
        sockets[userId] = socket
    })

    socket.on("offer", ({ target, offer }) => {
        sockets[target]?.emit("offer", { from: socket.userId, offer })
    })

    socket.on("answer", ({ target, answer }) => {
        sockets[target]?.emit("answer", { from: socket.userId, answer })
    })

    socket.on("ice-candidate", ({ target, candidate }) => {
        sockets[target]?.emit("ice-candidate", { from: socket.userId, candidate })
    })

    socket.on("disconnect", () => {
        if (socket.userId) delete sockets[socket.userId]
    })
})

function distance(p1, p2) {
    return Math.sqrt(
        (p1.x - p2.x) ** 2 +
        (p1.y - p2.y) ** 2 +
        (p1.z - p2.z) ** 2
    )
}

setInterval(() => {
    for (let id1 in sockets) {

        let heardList = []

        for (let id2 in sockets) {
            if (id1 === id2) continue

            let pos1 = positions[id1]
            let pos2 = positions[id2]
            if (!pos1 || !pos2) continue

            let dist = distance(pos1, pos2)
            let maxDist = 50
            let volume = dist < maxDist ? 1 - dist / maxDist : 0

            if (volume > 0) {
                heardList.push({
                    userId: id2,
                    username: usernames[id2],
                    volume
                })
            }

            sockets[id1].emit("volume", {
                target: id2,
                volume
            })
        }

        sockets[id1].emit("heardList", heardList)
    }
}, 300)

server.listen(process.env.PORT || 3000)