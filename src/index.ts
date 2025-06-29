import cors from 'cors'
import dotenv from 'dotenv'
import express, { NextFunction, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import cron from 'node-cron'
import { DB_NAME, MempoolSyncCronJobOptions, MONGODB_URI, TokenSyncCronJobOptions } from './config/constants.js'
import { database } from './config/database.js'
import { syncMempoolTransactions } from './cron-jobs/syncMempoolTransactions.js'
import { syncTokens } from './cron-jobs/syncTokens.js'
import { sanitizeRequest, securityHeaders, validateContentType } from './middleware/security.js'
import authRoutes from './routes/authRoutes.js'
import referralRoutes from './routes/referralRoutes.js'
import userRoutes from './routes/userRoutes.js'

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Security middleware
app.use(helmet());
app.use(securityHeaders);

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  }
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request sanitization
app.use(sanitizeRequest);

// Content type validation
app.use(validateContentType);

// Request logging middleware
app.use((req: Request, _: Response, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Basic routes
app.get('/', (_: Request, res: Response) => {
  res.json({
    message: 'Welcome to Project Alkanes Backend API!',
    status: 'Server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Health check route
app.get('/health', (_: Request, res: Response) => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: 'connected' // Simplified for now
  });
});

// API routes
app.use('/api/users', userRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/auth', authRoutes);

// 404 handler
app.use((_: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((error: Error, _1: Request, res: Response, _2: NextFunction) => {
  console.error('Global error handler:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Start server
async function startServer() {
  try {
    // Connect to database
    await database.connect(MONGODB_URI, DB_NAME);
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📡 API available at http://localhost:${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`👥 User API: http://localhost:${PORT}/api/users`);
      console.log(`🎯 Referral API: http://localhost:${PORT}/api/referral`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  await database.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  await database.disconnect();
  process.exit(0);
});

if (MempoolSyncCronJobOptions.enabled) {
  console.log(`🔄 Mempool sync cron job is enabled`);
  cron.schedule(MempoolSyncCronJobOptions.cronExpression, syncMempoolTransactions);
}

if (TokenSyncCronJobOptions.enabled) {
  console.log(`🔄 Token sync cron job is enabled`);
  cron.schedule(TokenSyncCronJobOptions.cronExpression, syncTokens);
}

startServer()
