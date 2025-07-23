import { Request, Response, Router } from 'express';
import { requireReferralForReferralAction } from '../middleware/referralGate.js';
import { validateParams, validateRequest } from '../middleware/validation.js';
import { ReferralService } from '../services/referralService.js';
import { createCustomLinkSchema, enterReferralCodeSchema, walletAddressSchema } from '../validation/referralValidation.js';

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

// Create custom referral link
router.post('/create-custom-link', validateRequest(createCustomLinkSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { walletAddress, customReferralId } = req.body;

    // Check if user was referred before allowing them to create custom links
    const referralCheck = await requireReferralForReferralAction(walletAddress);
    if (!referralCheck.allowed) {
      res.status(403).json({
        success: false,
        message: referralCheck.message,
        code: 'REFERRAL_REQUIRED'
      });
      return;
    }

    const referralService = new ReferralService();
    const result = await referralService.createCustomReferralLink(walletAddress, customReferralId);
    
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
    console.error('Error creating custom referral link:', error);
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
