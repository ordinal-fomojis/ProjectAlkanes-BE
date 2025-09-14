import { NextFunction, Response } from 'express'
import { UserService } from '../services/userService.js'
import { UserError } from '../utils/errors.js'
import { AuthenticatedRequest } from './auth.js'

export async function requireReferral(
  req: AuthenticatedRequest,
  _: Response,
  next: NextFunction
): Promise<void> {
  // Get user wallet address from JWT token
  const userWalletAddress = req.user?.walletAddress
  
  if (userWalletAddress == null) {
    throw new UserError('Authentication required').withStatus(401)
  }

  await checkReferral(userWalletAddress)

  // User was referred, allow the request to proceed
  next()
}

export async function checkReferral(walletAddress: string) {
  const userService = new UserService()
  const user = await userService.getUserByWalletAddress(walletAddress)

  if (user == null) {
    throw new UserError('User not found').withStatus(401)
  }

  // Check if user was referred
  if (user.referredBy == null) {
    throw new UserError('Access denied: You must be referred by another user to perform this action. Please enter a referral code first').withStatus(403)
  }
} 
