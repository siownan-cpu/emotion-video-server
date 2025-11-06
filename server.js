const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ 
    status: 'Server is running',
    connections: io.engine.clientsCount
  });
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    console.log(`User ${socket.id} joining room: ${roomId}`);
    socket.join(roomId);
    
    const roomUsers = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    const otherUsers = roomUsers.filter(id => id !== socket.id);
    
    if (otherUsers.length > 0) {
      socket.emit('room-users', otherUsers);
    }
    
    socket.to(roomId).emit('user-joined', socket.id);
  });

  socket.on('offer', (data) => {
    io.to(data.to).emit('offer', {
      offer: data.offer,
      from: socket.id
    });
  });

  socket.on('answer', (data) => {
    io.to(data.to).emit('answer', {
      answer: data.answer,
      from: socket.id
    });
  });

  socket.on('ice-candidate', (data) => {
    io.to(data.to).emit('ice-candidate', {
      candidate: data.candidate,
      from: socket.id
    });
  });

  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
    socket.to(roomId).emit('user-left', { userId: socket.id });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    socket.rooms.forEach(roomId => {
      if (roomId !== socket.id) {
        socket.to(roomId).emit('user-left', { userId: socket.id });
      }
    });
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
