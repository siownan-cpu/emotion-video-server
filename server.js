const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const httpServer = createServer(app);

// CORS configuration
const io = new Server(httpServer, {
  cors: {
    origin: [
      'https://emotion-video-client.vercel.app',
      'http://localhost:5173',
      'http://localhost:3000'
    ],
    methods: ['GET', 'POST'],
    credentials: true
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

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    connections: io.engine.clientsCount
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    console.log(`🚪 User ${socket.id} joining room: ${roomId}`);
    socket.join(roomId);
    
    // Get all users in room
    const roomUsers = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    const otherUsers = roomUsers.filter(id => id !== socket.id);
    
    console.log(`📋 Room ${roomId} now has ${roomUsers.length} users:`, roomUsers);
    console.log(`👥 Other users for ${socket.id}:`, otherUsers);
    
    // Send list of existing users to the newly joined user
    if (otherUsers.length > 0) {
      socket.emit('room-users', otherUsers);
      console.log(`📤 Sent room-users to ${socket.id}:`, otherUsers);
    } else {
      console.log(`ℹ️ No other users in room for ${socket.id}`);
    }
    
    // Notify others in the room about the new user
    socket.to(roomId).emit('user-joined', socket.id);
    console.log(`📢 Notified room ${roomId} about new user: ${socket.id}`);
  });

  socket.on('offer', (data) => {
    console.log(`\n📨 OFFER received`);
    console.log(`   From: ${socket.id}`);
    console.log(`   To: ${data.to}`);
    console.log(`   Has offer: ${!!data.offer}`);
    console.log(`   Offer type: ${data.offer?.type}`);
    
    if (!data.to) {
      console.error('❌ OFFER missing "to" field!');
      return;
    }
    
    if (!data.offer) {
      console.error('❌ OFFER missing "offer" field!');
      return;
    }
    
    const offerData = {
      offer: data.offer,
      from: socket.id
    };
    
    io.to(data.to).emit('offer', offerData);
    console.log(`✅ Forwarded offer from ${socket.id} to ${data.to}`);
  });

  socket.on('answer', (data) => {
    console.log(`\n📨 ANSWER received`);
    console.log(`   From: ${socket.id}`);
    console.log(`   To: ${data.to}`);
    console.log(`   Has answer: ${!!data.answer}`);
    console.log(`   Answer type: ${data.answer?.type}`);
    
    if (!data.to) {
      console.error('❌ ANSWER missing "to" field!');
      return;
    }
    
    if (!data.answer) {
      console.error('❌ ANSWER missing "answer" field!');
      return;
    }
    
    const answerData = {
      answer: data.answer,
      from: socket.id
    };
    
    io.to(data.to).emit('answer', answerData);
    console.log(`✅ Forwarded answer from ${socket.id} to ${data.to}`);
  });

  // ✨ ENHANCED ICE CANDIDATE HANDLING WITH DETAILED LOGGING
  socket.on('ice-candidate', (data) => {
    console.log(`\n🧊 ICE CANDIDATE received`);
    console.log(`   From: ${socket.id}`);
    console.log(`   To: ${data.to}`);
    
    // Validate required fields
    if (!data.to) {
      console.error('❌ ICE candidate missing "to" field!');
      console.error('   Received data:', JSON.stringify(data, null, 2));
      return;
    }
    
    if (!data.candidate) {
      console.error('❌ ICE candidate missing "candidate" field!');
      console.error('   Received data:', JSON.stringify(data, null, 2));
      return;
    }
    
    // Log candidate details
    console.log(`   Candidate details:`);
    console.log(`      Type: ${data.candidate.type || 'unknown'}`);
    console.log(`      Protocol: ${data.candidate.protocol || 'unknown'}`);
    console.log(`      Address: ${data.candidate.address || 'unknown'}`);
    console.log(`      Port: ${data.candidate.port || 'unknown'}`);
    console.log(`      Priority: ${data.candidate.priority || 'unknown'}`);
    console.log(`      Foundation: ${data.candidate.foundation || 'unknown'}`);
    console.log(`      Component: ${data.candidate.component || 'unknown'}`);
    console.log(`      sdpMid: ${data.candidate.sdpMid || 'unknown'}`);
    console.log(`      sdpMLineIndex: ${data.candidate.sdpMLineIndex}`);
    console.log(`      Candidate string: ${data.candidate.candidate || 'unknown'}`);
    
    // Check if candidate is end-of-candidates
    if (!data.candidate.candidate || data.candidate.candidate === '') {
      console.log('ℹ️ End-of-candidates signal received');
    }
    
    // Forward with 'from' field - PRESERVE ALL CANDIDATE DATA
    const candidateData = {
      candidate: {
        ...data.candidate  // Spread all properties of the candidate
      },
      from: socket.id
    };
    
    console.log(`   Forwarding complete candidate object to ${data.to}`);
    io.to(data.to).emit('ice-candidate', candidateData);
    console.log(`✅ ICE candidate forwarded from ${socket.id} to ${data.to}\n`);
  });

  socket.on('leave-room', (roomId) => {
    console.log(`🚪 User ${socket.id} leaving room: ${roomId}`);
    socket.leave(roomId);
    socket.to(roomId).emit('user-left', { userId: socket.id });
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
    
    // Notify all rooms this user was in
    socket.rooms.forEach(roomId => {
      if (roomId !== socket.id) {
        socket.to(roomId).emit('user-left', { userId: socket.id });
        console.log(`📢 Notified room ${roomId} about disconnect: ${socket.id}`);
      }
    });
  });
  
  // Add error handler
  socket.on('error', (error) => {
    console.error('❌ Socket error for', socket.id, ':', error);
  });
});

// Global error handlers
io.engine.on('connection_error', (err) => {
  console.error('❌ Connection error:', err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled rejection:', err);
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🚀 Emotion Video Call Server - ENHANCED DEBUG MODE`);
  console.log(`${'='.repeat(50)}`);
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`🔧 CORS enabled for: https://emotion-video-client.vercel.app`);
  console.log(`📡 Socket.IO ready with enhanced logging`);
  console.log(`🐛 Debug mode: ALL ICE candidates will be logged`);
  console.log(`${'='.repeat(50)}\n`);
});
