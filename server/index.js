const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = require("socket.io")(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://ghoststream-vbbi.vercel.app"
    ],
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  
  socket.on("join_room", (roomID) => {
    const room = io.sockets.adapter.rooms.get(roomID);
    
    if (room && room.size >= 2) {
        socket.emit("room_full");
        return;
    }

    socket.join(roomID);
    socket.to(roomID).emit("user_joined", socket.id); 
    
    console.log(`User ${socket.id} joined ${roomID}. Count: ${room ? room.size + 1 : 1}`);
  });

  socket.on("call_user", (payload) => {
    io.to(payload.userToCall).emit("receiving_call", { 
      signal: payload.signalData, 
      from: payload.from 
    });
  });

  socket.on("answer_call", (payload) => {
    io.to(payload.to).emit("call_accepted", payload.signal);
  });

  socket.on('disconnecting', () => {
      socket.rooms.forEach(room => {
          socket.to(room).emit("user_disconnected", socket.id);
      });
  });

  socket.on('disconnect', () => {
      console.log('User Disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`SERVER RUNNING ON ${PORT}`));