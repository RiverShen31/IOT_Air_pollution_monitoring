import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { connectDB } from './config/db.js';
import { connectMqtt } from './config/mqtt.js';
import { initSocket } from './socket.js';
import { startMqttIngestService } from './services/mqttIngestService.js';

import authRoutes from './routes/authRoutes.js';
import deviceRoutes from './routes/deviceRoutes.js';
import readingRoutes from './routes/readingRoutes.js';
import ingestRoutes from './routes/ingestRoutes.js';

import { apiLimiter } from './middleware/rateLimiter.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

const app = express();
const httpServer = http.createServer(app);

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(helmet());
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '256kb' }));
app.use('/api', apiLimiter);

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/readings', readingRoutes);
app.use('/api/ingest', ingestRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

async function main() {
  await connectDB();

  const io = initSocket(httpServer, corsOrigin);
  app.set('io', io);

  const mqttClient = connectMqtt();
  startMqttIngestService(mqttClient, io);

  const port = process.env.PORT || 4000;
  httpServer.listen(port, () => console.log(`[server] listening on http://localhost:${port}`));
}

main().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
