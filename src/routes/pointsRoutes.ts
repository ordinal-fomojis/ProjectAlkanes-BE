import { Request, Response, Router } from 'express';
import { getNextTier, getTierByPoints, TIER_SYSTEM } from '../config/tiers.js';
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

// Get user info including points and tier information
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

    // Calculate tier information
    const pointsFromReferrals = user.pointsEarnedFromReferrals || 0;
    const currentTier = getTierByPoints(pointsFromReferrals);
    const nextTier = getNextTier(currentTier);
    const pointsToNextTier = nextTier ? nextTier.threshold - pointsFromReferrals : undefined;

    res.json({
      success: true,
      data: {
        _id: user._id,
        walletAddress: user.walletAddress,
        points: user.points || 0,
        pointsEarnedFromReferrals: pointsFromReferrals,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        referralCode: user.referralCode,
        customReferralId: user.customReferralId,
        totalReferrals: user.referredUsers?.length || 0,
        tier: {
          level: currentTier.level,
          bonus: currentTier.bonus,
          threshold: currentTier.threshold,
          rank: currentTier.rank
        },
        nextTier: nextTier ? {
          level: nextTier.level,
          bonus: nextTier.bonus,
          threshold: nextTier.threshold,
          rank: nextTier.rank
        } : null,
        pointsToNextTier: pointsToNextTier
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

// Get tier system information
router.get('/tiers', async (_: Request, res: Response): Promise<void> => {
  try {
    res.json({
      success: true,
      data: {
        tiers: TIER_SYSTEM.map(tier => ({
          level: tier.level,
          bonus: tier.bonus,
          threshold: tier.threshold,
          rank: tier.rank,
          bonusPercentage: Math.round((tier.bonus - 1) * 100) // Convert 1.2 to 20%
        })),
        description: "Tier system for referral point bonuses. Higher tiers give bonus multipliers for points earned from referrals."
      }
    });
  } catch (error) {
    console.error('Error getting tier info:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 
