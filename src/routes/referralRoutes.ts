import { Request, Response, Router } from 'express';
import { validateRequest, validateParams } from '../middleware/validation.js';
import { ReferralService } from '../services/referralService.js';
import { enterReferralCodeSchema, walletAddressSchema } from '../validation/referralValidation.js';

const router = Router();

// Get referral account info
router.get('/account/:walletAddress', validateParams(walletAddressSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const referralService = new ReferralService();
    const walletAddress = req.params.walletAddress;

    if (!walletAddress) {
      res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      });
      return;
    }

    const referralInfo = await referralService.getReferralInfo(walletAddress);
    
    if (!referralInfo) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      data: referralInfo
    });
  } catch (error) {
    console.error('Error getting referral info:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Enter referral code
router.post('/enter-code', validateRequest(enterReferralCodeSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const referralService = new ReferralService();
    const { walletAddress, referralCode } = req.body;

    const result = await referralService.enterReferralCode(walletAddress, referralCode);
    
    if (!result.success) {
      res.status(400).json({
        success: false,
        message: result.message
      });
      return;
    }

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Error entering referral code:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 