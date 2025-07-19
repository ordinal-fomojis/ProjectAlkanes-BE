import { Request, Response, Router } from 'express';
import { validateParams } from '../middleware/validation.js';
import { PointsService } from '../services/PointsService.js';
import { walletAddressSchema } from '../validation/userValidation.js';

const router = Router();

// Get points balance for a wallet
router.get('/balance/:walletAddress', validateParams(walletAddressSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const pointsService = new PointsService();
    const walletAddress = req.params.walletAddress;

    if (!walletAddress) {
      res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      });
      return;
    }

    const pointsBalance = await pointsService.getPointsBalance(walletAddress);
    
    res.json({
      success: true,
      data: {
        walletAddress,
        points: pointsBalance
      }
    });
  } catch (error) {
    console.error('Error getting points balance:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get user info including points
router.get('/user/:walletAddress', validateParams(walletAddressSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const pointsService = new PointsService();
    const walletAddress = req.params.walletAddress;

    if (!walletAddress) {
      res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      });
      return;
    }

    const user = await pointsService.getUserByWallet(walletAddress);
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      data: {
        _id: user._id,
        walletAddress: user.walletAddress,
        points: user.points || 0,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        referralCode: user.referralCode,
        customReferralId: user.customReferralId,
        totalReferrals: user.referredUsers?.length || 0
      }
    });
  } catch (error) {
    console.error('Error getting user info:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 
