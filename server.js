// Enhanced WebRTC Signaling Server with AssemblyAI Integration
// This handles the connection setup between two parties and provides AssemblyAI tokens

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({
  origin: [
    'https://emotion-video-client.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true
}));
app.use(express.json());

const httpServer = http.createServer(app);

// Socket.IO configuration
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

// ✨ AssemblyAI Token Generation Endpoint (Using Native Fetch)
// server.js
app.post('/api/assemblyai-token', async (req, res) => {
  try {
    console.log('🔑 Generating AssemblyAI temporary token...');
    const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
    if (!ASSEMBLYAI_API_KEY) {
      console.error('❌ ASSEMBLYAI_API_KEY not set in environment variables');
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'AssemblyAI API key not configured',
      });
    }

    // Accept TTL from query/body, default to 60s, clamp to 1–600
    const ttlRaw =
      req.query?.expires_in_seconds ??
      req.body?.expires_in_seconds ??
      60;
    const expiresInSeconds = Math.min(600, Math.max(1, Number(ttlRaw) || 60));

    // Optional: cap session duration (defaults to 10800 = 3h)
    const maxSessionRaw =
      req.query?.max_session_duration_seconds ??
      req.body?.max_session_duration_seconds ??
      10800;
    const maxSessionDurationSeconds = Math.min(10800, Math.max(60, Number(maxSessionRaw) || 10800));

    const url = new URL('https://streaming.assemblyai.com/v3/token');
    url.search = new URLSearchParams({
      expires_in_seconds: String(expiresInSeconds),
      max_session_duration_seconds: String(maxSessionDurationSeconds),
    }).toString();

    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: ASSEMBLYAI_API_KEY },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ AssemblyAI token generation failed:', response.status, errorText);
      return res.status(response.status).json({
        error: 'Failed to generate token',
        details: errorText,
      });
    }

    const data = await response.json();
    console.log('✅ AssemblyAI token generated successfully');
    // Return the field names exactly as v3 returns them
    res.json({
      token: data.token,
      expires_in_seconds: data.expires_in_seconds,
    });
  } catch (error) {
    console.error('❌ Error generating AssemblyAI token:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});


// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);

  // Join a room
  socket.on('join-room', (roomId) => {
    console.log(`🚪 User ${socket.id} joining room: ${roomId}`);
    socket.join(roomId);

    // Get all users in room
    const roomUsers = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    const otherUsers = roomUsers.filter(id => id !== socket.id);

    console.log(`📋 Room ${roomId} users:`, roomUsers.length);
    console.log(`👥 Other users in room:`, otherUsers);

    // Send list of existing users to the newly joined user
    if (otherUsers.length > 0) {
      socket.emit('room-users', otherUsers);
      console.log(`📤 Sent room-users to ${socket.id}:`, otherUsers);
    }

    // Notify others in the room about the new user
    socket.to(roomId).emit('user-joined', socket.id);
    console.log(`📢 Notified room ${roomId} about new user: ${socket.id}`);
  });

  // WebRTC signaling - Forward offer
  socket.on('offer', (data) => {
    console.log(`📨 Offer from ${socket.id} to ${data.to}`);
    
    const offerData = {
      offer: data.offer,
      from: socket.id
    };
    
    io.to(data.to).emit('offer', offerData);
    console.log(`📤 Forwarded offer to ${data.to}`);
  });

  // WebRTC signaling - Forward answer
  socket.on('answer', (data) => {
    console.log(`📨 Answer from ${socket.id} to ${data.to}`);
    
    const answerData = {
      answer: data.answer,
      from: socket.id
    };
    
    io.to(data.to).emit('answer', answerData);
    console.log(`📤 Forwarded answer to ${data.to}`);
  });

  // WebRTC signaling - Forward ICE candidates
  socket.on('ice-candidate', (data) => {
    console.log(`🧊 ICE candidate from ${socket.id} to ${data.to}`);
    console.log(`   Candidate type: ${data.candidate?.type || 'unknown'}`);
    
    // Validate required fields
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
    console.log('❌ User disconnected:', socket.id);

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
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 CORS enabled for: https://emotion-video-client.vercel.app`);
  console.log(`📡 Socket.IO ready`);
  console.log(`🔑 AssemblyAI integration: ${process.env.ASSEMBLYAI_API_KEY ? '✅ Enabled' : '❌ Disabled (API key missing)'}`);
  console.log(`📦 Node.js version: ${process.version}`);
});
