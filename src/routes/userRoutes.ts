import { Request, Response, Router } from 'express'
import z from 'zod'
import { validateParams, validateRequest } from '../middleware/validation'
import { UserService } from '../services/userService'
import { createUserSchema, walletAddressSchema } from '../validation/userValidation'

const router = Router();

// Create or connect user (wallet login)
router.post('/', validateRequest(createUserSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const userService = new UserService();
    const user = await userService.createUser(req.body);
    
    res.status(201).json({
      success: true,
      message: 'User connected successfully',
      data: {
        _id: user._id,
        walletAddress: user.walletAddress,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      }
    });
  } catch (error) {
    console.error('Error creating/connecting user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get user by wallet address
router.get('/:walletAddress', validateParams(walletAddressSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const userService = new UserService()
    const walletAddress = z.string().safeParse(req.params.walletAddress)

    if (!walletAddress.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid wallet address format'
      });
      return;
    }

    const user = await userService.getUserByWalletAddress(walletAddress.data)
    
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
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      }
    });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 
