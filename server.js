// Simple WebRTC Signaling Server
// This handles the connection setup between two parties

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: [
      "https://emotion-video-client.vercel.app/",  // ⚠️ REPLACE THIS!
      "http://localhost:3000",
      "http://localhost:5173"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Store active rooms
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a room
  socket.on('join-room', (roomId) => {
    console.log(`User ${socket.id} joining room ${roomId}`);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, []);
    }
    
    const room = rooms.get(roomId);
    
    // Limit to 2 people per room
    if (room.length >= 2) {
      socket.emit('room-full');
      return;
    }
    
    room.push(socket.id);
    socket.join(roomId);
    
    // Notify others in the room
    socket.to(roomId).emit('user-joined', socket.id);
    
    // Send existing users to the new user
    socket.emit('room-users', room.filter(id => id !== socket.id));
  });

  // WebRTC signaling
  socket.on('offer', (data) => {
    console.log('Offer from', socket.id, 'to', data.to);
    socket.to(data.to).emit('offer', {
      offer: data.offer,
      from: socket.id
    });
  });

  socket.on('answer', (data) => {
    console.log('Answer from', socket.id, 'to', data.to);
    socket.to(data.to).emit('answer', {
      answer: data.answer,
      from: socket.id
    });
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.to).emit('ice-candidate', {
      candidate: data.candidate,
      from: socket.id
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove from all rooms
    rooms.forEach((room, roomId) => {
      const index = room.indexOf(socket.id);
      if (index !== -1) {
        room.splice(index, 1);
        socket.to(roomId).emit('user-left', socket.id);
        
        // Clean up empty rooms
        if (room.length === 0) {
          rooms.delete(roomId);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
