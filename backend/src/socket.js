import { Server } from 'socket.io';
import { verifyAccessToken } from './utils/jwt.js';

// Xác thực JWT ngay tại bước handshake WebSocket — không cho phép kết nối ẩn danh.
// Mỗi client chỉ join room riêng theo userId, nên chỉ nhận được dữ liệu thiết bị của chính mình.
export function initSocket(httpServer, corsOrigin) {
  const io = new Server(httpServer, {
    cors: { origin: corsOrigin, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const payload = verifyAccessToken(token);
      socket.userId = payload.sub;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
    console.log(`[socket] user ${socket.userId} connected (${socket.id})`);

    socket.on('disconnect', () => {
      console.log(`[socket] user ${socket.userId} disconnected (${socket.id})`);
    });
  });

  return io;
}
