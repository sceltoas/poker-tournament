import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import authRouter from './routes/auth';
import tournamentRouter from './routes/tournaments';
import playerRouter from './routes/players';
import pushRouter from './routes/push';
import { setupWebSocket } from './services/websocket';

export const prisma = new PrismaClient();

const app = express();
const server = http.createServer(app);
const isProd = process.env.NODE_ENV === 'production';

const io = new SocketIOServer(server, {
  cors: isProd ? undefined : {
    origin: process.env.APP_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  },
});

if (!isProd) {
  app.use(cors({
    origin: process.env.APP_URL || 'http://localhost:5173',
    credentials: true,
  }));
}
app.use(express.json());

// Make io accessible to routes
app.set('io', io);

// Routes
app.use('/api/auth', authRouter);
app.use('/api/tournaments', tournamentRouter);
app.use('/api/players', playerRouter);
app.use('/api/push', pushRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// In production, serve the Vite-built client
if (isProd) {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  // SPA fallback — all non-API routes serve index.html
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// WebSocket
setupWebSocket(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}${isProd ? ' (production)' : ''}`);
});
