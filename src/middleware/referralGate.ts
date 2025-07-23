import { NextFunction, Response } from 'express'
import { UserService } from '../services/userService.js'
import { AuthenticatedRequest } from './auth.js'

export async function requireReferral(
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
): Promise<void> {
  try {
    // Get user wallet address from JWT token
    const userWalletAddress = req.user?.walletAddress;
    
    if (!userWalletAddress) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    const userService = new UserService();
    const user = await userService.getUserByWalletAddress(userWalletAddress);

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Check if user was referred (has referredBy field)
    if (!user.referredBy) {
      res.status(403).json({
        success: false,
        message: 'Access denied: You must be referred by another user to perform this action. Please enter a referral code first.',
        code: 'REFERRAL_REQUIRED'
      });
      return;
    }

    // User was referred, allow the request to proceed
    next();
  } catch (error) {
    console.error('Error in referral gate middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

export async function requireReferralForReferralAction(
  walletAddress: string
): Promise<{ allowed: boolean; message?: string }> {
  try {
    const userService = new UserService();
    const user = await userService.getUserByWalletAddress(walletAddress);

    if (!user) {
      return { allowed: false, message: 'User not found' };
    }

    // Check if user was referred
    if (!user.referredBy) {
      return { 
        allowed: false, 
        message: 'Access denied: You must be referred by another user before you can refer others. Please enter a referral code first.' 
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Error checking referral requirement:', error);
    return { allowed: false, message: 'Internal server error' };
  }
} 
