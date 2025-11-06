// Simple WebRTC Signaling Server
// This handles the connection setup between two parties

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const httpServer = createServer(app);

const server = http.createServer(app);
const io = socketIO(server, {
// CORS configuration
const io = new Server(httpServer, {
cors: {
origin: [
      "https://emotion-video-client.vercel.app/",  // ⚠️ REPLACE THIS!
      "http://localhost:3000",
      "http://localhost:5173"
      'https://emotion-video-client.vercel.app',
      'http://localhost:5173',
      'http://localhost:3000'
],
    methods: ["GET", "POST"],
    methods: ['GET', 'POST'],
credentials: true
  }
  },
  transports: ['websocket', 'polling']
});

app.use(cors({
  origin: [
    'https://emotion-video-client.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'Server is running',
    timestamp: new Date().toISOString(),
    connections: io.engine.clientsCount
  });
});

// Store active rooms
const rooms = new Map();
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    connections: io.engine.clientsCount
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  console.log('✅ User connected:', socket.id);

  // Join a room
socket.on('join-room', (roomId) => {
    console.log(`User ${socket.id} joining room ${roomId}`);
    console.log(`🚪 User ${socket.id} joining room: ${roomId}`);
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, []);
    }
    // Get all users in room
    const roomUsers = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    const otherUsers = roomUsers.filter(id => id !== socket.id);

    const room = rooms.get(roomId);
    console.log(`📋 Room ${roomId} users:`, roomUsers.length);
    console.log(`👥 Other users in room:`, otherUsers);

    // Limit to 2 people per room
    if (room.length >= 2) {
      socket.emit('room-full');
      return;
    // Send list of existing users to the newly joined user
    if (otherUsers.length > 0) {
      socket.emit('room-users', otherUsers);
      console.log(`📤 Sent room-users to ${socket.id}:`, otherUsers);
}

    room.push(socket.id);
    socket.join(roomId);
    
    // Notify others in the room
    // Notify others in the room about the new user
socket.to(roomId).emit('user-joined', socket.id);
    
    // Send existing users to the new user
    socket.emit('room-users', room.filter(id => id !== socket.id));
    console.log(`📢 Notified room ${roomId} about new user: ${socket.id}`);
});

  // WebRTC signaling
  // ✨ CRITICAL: Forward offer with proper from/to fields
socket.on('offer', (data) => {
    console.log('Offer from', socket.id, 'to', data.to);
    socket.to(data.to).emit('offer', {
    console.log(`📨 Offer from ${socket.id} to ${data.to}`);
    
    // Ensure 'from' field is set
    const offerData = {
offer: data.offer,
from: socket.id
    });
    };
    
    io.to(data.to).emit('offer', offerData);
    console.log(`📤 Forwarded offer to ${data.to}`);
});

  // ✨ CRITICAL: Forward answer with proper from/to fields
socket.on('answer', (data) => {
    console.log('Answer from', socket.id, 'to', data.to);
    socket.to(data.to).emit('answer', {
    console.log(`📨 Answer from ${socket.id} to ${data.to}`);
    
    // Ensure 'from' field is set
    const answerData = {
answer: data.answer,
from: socket.id
    });
    };
    
    io.to(data.to).emit('answer', answerData);
    console.log(`📤 Forwarded answer to ${data.to}`);
});

  // ✨ CRITICAL FIX: Properly forward ICE candidates
socket.on('ice-candidate', (data) => {
    socket.to(data.to).emit('ice-candidate', {
    console.log(`🧊 ICE candidate from ${socket.id} to ${data.to}`);
    console.log(`   Candidate type: ${data.candidate?.type || 'unknown'}`);
    
    // Ensure all required fields are present
    if (!data.to) {
      console.error('❌ ICE candidate missing "to" field!');
      return;
    }
    
    if (!data.candidate) {
      console.error('❌ ICE candidate missing "candidate" field!');
      return;
    }
    
    // Forward with 'from' field
    const candidateData = {
candidate: data.candidate,
from: socket.id
    });
    };
    
    io.to(data.to).emit('ice-candidate', candidateData);
    console.log(`✅ Forwarded ICE candidate to ${data.to}`);
  });

  // Handle room leave
  socket.on('leave-room', (roomId) => {
    console.log(`🚪 User ${socket.id} leaving room: ${roomId}`);
    socket.leave(roomId);
    socket.to(roomId).emit('user-left', { userId: socket.id });
});

// Handle disconnection
socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    console.log('❌ User disconnected:', socket.id);

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
    // Notify all rooms this user was in
    socket.rooms.forEach(roomId => {
      if (roomId !== socket.id) {
        socket.to(roomId).emit('user-left', { userId: socket.id });
        console.log(`📢 Notified room ${roomId} about disconnect: ${socket.id}`);
}
});
});
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 CORS enabled for: https://emotion-video-client.vercel.app`);
  console.log(`📡 Socket.IO ready`);
});
