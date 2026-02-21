const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let players = {}; // userId -> { username, x, y, speaking }

app.post("/updatePosition", (req, res) => {
    const { userId, username, x, y } = req.body;
    if (!players[userId]) {
        players[userId] = { username, x, y, speaking: false };
    } else {
        players[userId].x = x;
        players[userId].y = y;
    }
    res.sendStatus(200);
});

io.on("connection", socket => {

    socket.on("register", ({ userId }) => {
        socket.userId = userId;
    });

    socket.on("speaking", ({ speaking }) => {
        if (players[socket.userId]) {
            players[socket.userId].speaking = speaking;
        }
    });

    socket.on("offer", data => {
        io.to(data.target).emit("offer", {
            from: socket.userId,
            offer: data.offer
        });
    });

    socket.on("answer", data => {
        io.to(data.target).emit("answer", {
            from: socket.userId,
            answer: data.answer
        });
    });

    socket.on("ice-candidate", data => {
        io.to(data.target).emit("ice-candidate", {
            from: socket.userId,
            candidate: data.candidate
        });
    });

    socket.on("disconnect", () => {
        delete players[socket.userId];
    });
});

setInterval(() => {
    io.emit("playersUpdate", players);
}, 1000);

server.listen(3000, () => {
    console.log("Server running on port 3000");
});