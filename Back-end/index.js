import express from "express";
import "dotenv/config";
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import connectDb from "./config/connectdb.js";
import errorMiddleware from "./middleware/error.js";
import userRoute from "./routes/userRoutes.js";
import adminRoute from "./routes/adminRoutes.js";
import bidRoute from "./routes/bidRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import notificationRoutes from './routes/notificationRoutes.js';
import repairRequestRoutes from './routes/repairRequestRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import technicianRoutes from './routes/technicianRoutes.js';
import User from './models/userSchema.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const port = process.env.PORT || 4000;

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Make io accessible to routes
app.set('io', io);

app.use(express.json());

app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.originalUrl} ${req.statusCode}`);
    next();
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Socket.IO authentication middleware
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.userId = user._id.toString();
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
};

io.use(authenticateSocket);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.name} (${socket.userId})`);
  
  // Join user to their personal room
  socket.join(`user_${socket.userId}`);
  
  // Join chat rooms
  socket.on('join_chat', (chatId) => {
    socket.join(`chat_${chatId}`);
    console.log(`User ${socket.userId} joined chat ${chatId}`);
  });
  
  // Leave chat rooms
  socket.on('leave_chat', (chatId) => {
    socket.leave(`chat_${chatId}`);
    console.log(`User ${socket.userId} left chat ${chatId}`);
  });
  

  
  // Handle message status updates
  socket.on('message_read', (data) => {
    socket.to(`chat_${data.chatId}`).emit('message_status_update', {
      messageId: data.messageId,
      status: 'read',
      readBy: socket.userId
    });
  });
  
  // Handle online status
  socket.on('user_online', () => {
    socket.broadcast.emit('user_status_change', {
      userId: socket.userId,
      status: 'online'
    });
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.user.name} (${socket.userId})`);
    socket.broadcast.emit('user_status_change', {
      userId: socket.userId,
      status: 'offline'
    });
  });
  
  // Handle errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Routes
app.get('/', (req, res) => {
    res.send("API is working fine.");
});

app.use('/api/user', userRoute);
app.use('/api/admin', adminRoute);
app.use('/api/bid', bidRoute);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/repair-requests', repairRequestRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/technicians', technicianRoutes);

app.use(errorMiddleware);

server.listen(port, '0.0.0.0', () => {
    connectDb();
    console.log(`Server is listening on http://localhost:${port}`);
    console.log('Socket.IO server is ready');
});

export { io };