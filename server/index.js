const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "http://localhost:3000", methods: ["GET", "POST"] }
});

io.on('connection', (socket) => {
  
  socket.on("join_room", (roomID) => {
    socket.join(roomID);
    // Tell everyone else in the room: "Hey, I'm here (socket.id)"
    socket.to(roomID).emit("user_joined", socket.id);
  });

  // Handshake Step 1: User A sends "Offer" to User B
  socket.on("call_user", (payload) => {
    io.to(payload.userToCall).emit("receiving_call", { 
      signal: payload.signalData, 
      from: payload.from 
    });
  });

  // Handshake Step 2: User B sends "Answer" back to User A
  socket.on("answer_call", (payload) => {
    io.to(payload.to).emit("call_accepted", payload.signal);
  });
});

server.listen(3001, () => console.log("SERVER RUNNING ON 3001"));