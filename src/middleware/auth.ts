import { NextFunction, Request, Response } from 'express'
import { recordException } from '../instrumentation/span.js'
import { AuthService } from '../services/authService.js'
import { UserError } from '../utils/errors.js'

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string
    walletAddress: string
  }
}

export async function authenticateJWT(
  req: AuthenticatedRequest,
  _: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : null

  if (token == null) {
    throw new UserError('Authorization token missing').withStatus(401)
  }

  const authService = new AuthService()
  const payload = await authService.validateJWT(token)

  req.user = {
    userId: payload.userId,
    walletAddress: payload.walletAddress
  }

  next()
}

export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    authenticateJWT(req, res, next)
  } catch(error) {
    // For optional auth, we don't fail the request if token is invalid
    // Just proceed without user info
    recordException(error, { setStatus: false })
    next()
  }
} 
