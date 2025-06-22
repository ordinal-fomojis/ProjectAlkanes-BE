import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    walletAddress: string;
  };
}

export const authenticateJWT = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access token is missing'
      });
      return;
    }

    const authService = new AuthService();
    const payload = await authService.validateJWT(token);

    req.user = {
      userId: payload.userId,
      walletAddress: payload.walletAddress
    };

    next();
  } catch (error) {
    console.error('JWT authentication failed:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      error: error instanceof Error ? error.message : 'Authentication failed'
    });
  }
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (token) {
      const authService = new AuthService();
      const payload = await authService.validateJWT(token);
      req.user = {
        userId: payload.userId,
        walletAddress: payload.walletAddress
      };
    }

    next();
  } catch (_error) {
    // For optional auth, we don't fail the request if token is invalid
    // Just proceed without user info
    next();
  }
}; 