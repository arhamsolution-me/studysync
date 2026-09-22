import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { errorHandler, generalLimiter } from './middleware';

// Route imports
import authRoutes from './modules/auth/auth.routes';
import taskRoutes from './modules/tasks/task.routes';
import voiceRoutes from './modules/voice/voice.routes';
import notificationRoutes from './modules/notifications/notification.routes';
import courseRoutes from './modules/courses/course.routes';
import whatsappRoutes from './modules/whatsapp/whatsapp.routes';
import apiKeyRoutes from './modules/auth/apiKey.routes';
import { whatsAppService } from './modules/whatsapp/whatsapp.service';
import {
  startStandaloneReminderEngine,
  checkAndInitRedisQueues,
} from './modules/notifications/notification.queue';

const app = express();

// ─── Security & Parsing Middleware ────────────────────────────────────

app.use(helmet({
  contentSecurityPolicy: config.isDev ? false : undefined,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5000',
  'http://localhost:3000',
  'https://studysync-tan.vercel.app',
  ...(config.frontendUrl ? config.frontendUrl.split(',').map((s) => s.trim()) : []),
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1')
    ) {
      return callback(null, true);
    }
    // Safe fallback to allow deployed previews
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// General rate limiter (100 req/min per IP)
app.use(generalLimiter);

// ─── Health Check ─────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'StudySync API is running.',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// ─── API Routes ───────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/user/keys', apiKeyRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'This endpoint does not exist. Check the URL and try again.',
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────

app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────

const startServer = async () => {
  try {
    // Start automated standalone email & WhatsApp reminder engine (active with or without Redis)
    startStandaloneReminderEngine();

    // Initialize WhatsApp multi-device client (reconnects saved session or awaits QR scan)
    whatsAppService.init().catch((err) => {
      console.warn('[Server] WhatsApp init background notice:', err.message);
    });

    // Check Redis and enable BullMQ workers only if Redis is running locally
    checkAndInitRedisQueues().catch(() => {});

    app.listen(config.port, () => {
      console.log('');
      console.log('  ╔══════════════════════════════════════════╗');
      console.log('  ║                                          ║');
      console.log('  ║   📚 StudySync AI — Backend Server       ║');
      console.log(`  ║   🌐 http://localhost:${config.port}              ║`);
      console.log(`  ║   🔧 Environment: ${config.nodeEnv.padEnd(19)}║`);
      console.log('  ║                                          ║');
      console.log('  ╚══════════════════════════════════════════╝');
      console.log('');
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
};

// ─── Process-Level Error Handlers (prevent WhatsApp Baileys crashes) ──
process.on('unhandledRejection', (reason: any) => {
  const msg = reason?.message || String(reason);
  // Suppress known Baileys timeout / socket errors
  if (/timed out|connection closed|stream end/i.test(msg)) {
    console.warn('[Process] Suppressed unhandledRejection (Baileys socket):', msg);
    return;
  }
  console.error('[Process] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err: Error) => {
  const msg = err?.message || '';
  if (/timed out|connection closed|stream end|ECONNRESET/i.test(msg)) {
    console.warn('[Process] Suppressed uncaughtException (Baileys socket):', msg);
    return;
  }
  console.error('[Process] Uncaught Exception:', err);
  // Only exit for truly fatal errors
  if (/EADDRINUSE|Cannot find module/i.test(msg)) {
    process.exit(1);
  }
});

startServer();

export default app;
