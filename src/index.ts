import { trace } from "@opentelemetry/api"
import cors from 'cors'
import express, { NextFunction, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import packageInfo from '../package.json' with { type: "json" }
import { DB_NAME, INITIALISE_INDEXES, MONGODB_URI } from './config/env-vars.js'
import { ENV } from './config/env.js'
import { database } from './database/database.js'
import { shutdownInstrumentation } from "./instrumentation/setup.js"
import { executeSpan, setAttributes, withSpan } from "./instrumentation/span.js"
import { securityHeaders, validateContentType } from './middleware/security.js'
import activityRoutes from './routes/activityRoutes.js'
import alkaneTokenRoutes from './routes/alkaneTokenRoutes.js'
import alkaneTransactionRoutes from './routes/alkaneTransactionRoutes.js'
import authRoutes from './routes/authRoutes.js'
import brcTokenRoutes from './routes/brcTokenRoutes.js'
import brcTransactionRoutes from './routes/brcTransactionRoutes.js'
import feeRoutes from './routes/feeRoutes.js'
import pointsRoutes from './routes/pointsRoutes.js'
import portfolioRoutes from './routes/portfolioRoutes.js'
import referralRoutes from './routes/referralRoutes.js'
import transactionConfirmationRoutes from './routes/transactionConfirmationRoutes.js'
import userRoutes from './routes/userRoutes.js'
import { FeeService } from './services/FeeService.js'
import { UserError } from './utils/errors.js'

const tracer = trace.getTracer('index')
executeSpan(tracer, 'initialisation', async () => {
  const app = express()
  const PORT = process.env.PORT || 8080

  // Security middleware
  app.use(helmet())
  app.use(securityHeaders)

  // CORS configuration
  if (process.env.CORS_ENABLED !== 'false' && typeof process.env.CORS_ORIGIN === 'string') {
    setAttributes({ corsOrigin: process.env.CORS_ORIGIN, corsEnabled: true })
    const corsOptions = {
      origin: new RegExp(process.env.CORS_ORIGIN),
      credentials: true,
      optionsSuccessStatus: 200
    }
    app.use(cors(corsOptions))
  } else {
    setAttributes({ corsEnabled: false })
  }

  const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED !== 'false'
  const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') // 15 minutes
  const rateLimitMaxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '500') // limit each IP to 500 requests per windowMs
  setAttributes({ rateLimitEnabled, rateLimitWindowMs, rateLimitMaxRequests })
  if (rateLimitEnabled) {
    // Rate limiting
    const limiter = rateLimit({
      windowMs: rateLimitWindowMs,
      max: rateLimitMaxRequests,
      message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
      }
    })
    app.use(limiter)
  }

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true, limit: '10mb' }))

  // Content type validation
  app.use(validateContentType)

  // Basic routes
  app.get('/api', (_: Request, res: Response) => {
    res.json({
      message: 'Welcome to Shovel Backend API!',
      status: 'Server is running',
      timestamp: new Date().toISOString(),
      version: packageInfo.version
    })
  })

  // Health check route
  app.get('/api/health', (_: Request, res: Response) => {
    if (!database.isConnected) {
      res.status(503).json({
        status: 'ERROR',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        message: 'Database not connected'
      })
      return
    }
    res.json({
      status: 'OK',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    })
  })

  // API routes
  app.use('/api/users', userRoutes)
  app.use('/api/referral', referralRoutes)
  app.use('/api/auth', authRoutes)
  app.use('/api/alkane/token', alkaneTokenRoutes)
  app.use('/api/brc/token', brcTokenRoutes)
  app.use('/api/alkane/tx', alkaneTransactionRoutes)
  app.use('/api/brc/tx', brcTransactionRoutes)
  app.use('/api/transaction', transactionConfirmationRoutes)
  app.use('/api/fees', feeRoutes)
  app.use('/api/points', pointsRoutes)
  app.use('/api/activity', activityRoutes)
  app.use('/api/portfolio', portfolioRoutes)

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      message: 'Route not found: ' + req.path
    })
  })

  // Global error handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((error: Error, _1: Request, res: Response, _2: NextFunction) => {
    if (error instanceof UserError) {
      console.warn(`${error.name} (${error.status}):`, error)
      res.status(error.status).json({
        success: false,
        name: error.name,
        message: error.message
      })
      return
    }
    
    console.error('Unexpected error (500):', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: ENV === 'production' ? 'Something went wrong' : error.message
    })
  })

  // Connect to database
  await database.connect(MONGODB_URI(), DB_NAME(), INITIALISE_INDEXES())

  // Initialize fee service
  const feeService = FeeService.getInstance()
  await feeService.initialize()
  
  // Start server
  const server = app.listen(PORT)

  const shutdown = withSpan(tracer, 'shutdown', async (signal: string) => {
    setAttributes({ signal })
    feeService.destroy()
    await database.disconnect()
    await new Promise<void>(resolve => server.close(() => resolve()))
    trace.getActiveSpan()?.end()
    await shutdownInstrumentation()
    process.exit(0)
  }, { endOnSuccess: false })
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
})
