const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")

const app = express()
app.use(cors())
app.use(express.json())

const server = http.createServer(app)
const io = new Server(server, { cors: { origin: "*" } })

let positions = {}
let sockets = {}
let usernames = {}

app.post("/update", (req, res) => {
    const { userId, username, x, y, z } = req.body
    positions[userId] = { x, y, z }
    usernames[userId] = username
    res.sendStatus(200)
})

// Authentification socket via UserId Roblox
io.on("connection", (socket) => {
    socket.on("register", (userId) => {
        if(!positions[userId]) {
            // Joueur non détecté dans Roblox → on refuse
            socket.emit("forbidden", "Vous devez être sur Roblox pour utiliser le chat vocal.")
            socket.disconnect()
            return
        }
        socket.userId = userId
        sockets[userId] = socket
    })

    socket.on("disconnect", () => {
        if(socket.userId) delete sockets[socket.userId]
    })
})

function distance(p1, p2) {
    return Math.sqrt(
        (p1.x - p2.x)**2 + (p1.y - p2.y)**2 + (p1.z - p2.z)**2
    )
}

// Calcul des volumes et liste de qui peut entendre
setInterval(() => {
    for(let id1 in sockets){
        let heardList = []
        for(let id2 in sockets){
            if(id1 === id2) continue
            let pos1 = positions[id1]
            let pos2 = positions[id2]
            if(!pos1 || !pos2) continue
            let dist = distance(pos1,pos2)
            let maxDist = 50
            let volume = dist < maxDist ? 1 - dist/maxDist : 0
            if(volume > 0) heardList.push({ userId: id2, username: usernames[id2], volume })
            sockets[id1].emit("volume", { target: id2, volume })
        }
        sockets[id1].emit("heardList", heardList)
    }
}, 200)

server.listen(process.env.PORT||3000, () => {
    console.log("Serveur lancé !")
})