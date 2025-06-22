import { Request, Response, Router } from 'express'
import { validateRequest } from '../middleware/validation.js'
import { AuthService } from '../services/authService.js'
import { nonceRequestSchema, verifySignatureSchema } from '../validation/authValidation.js'

const router = Router();

// Generate nonce for wallet authentication
router.post('/nonce', validateRequest(nonceRequestSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const authService = new AuthService();
    const { walletAddress } = req.body;
    
    const nonceData = await authService.generateNonce(walletAddress);
    
    res.status(200).json({
      success: true,
      message: 'Nonce generated successfully',
      data: {
        nonce: nonceData.nonce,
        message: nonceData.message,
        expiresAt: nonceData.expiresAt
      }
    });
  } catch (error) {
    console.error('Error generating nonce:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Verify wallet signature and return JWT
router.post('/verify', validateRequest(verifySignatureSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const authService = new AuthService();
    const { walletAddress, signature, message } = req.body;
    
    const authResult = await authService.verifySignatureAndCreateJWT(walletAddress, signature, message);
    
    res.status(200).json({
      success: true,
      message: 'Authentication successful',
      data: {
        token: authResult.token,
        user: authResult.user,
        expiresAt: authResult.expiresAt
      }
    });
  } catch (error) {
    console.error('Error verifying signature:', error);
    const status = error instanceof Error && error.message.includes('Invalid') ? 400 : 500;
    res.status(status).json({
      success: false,
      message: error instanceof Error ? error.message : 'Authentication failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// JWT token validation endpoint
router.post('/validate', async (req: Request, res: Response): Promise<void> => {
  try {
    const authService = new AuthService();
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      res.status(401).json({
        success: false,
        message: 'No token provided'
      });
      return;
    }
    
    const payload = await authService.validateJWT(token);
    
    res.status(200).json({
      success: true,
      message: 'Token is valid',
      data: {
        walletAddress: payload.walletAddress,
        userId: payload.userId,
        expiresAt: new Date(payload.exp * 1000)
      }
    });
  } catch (error) {
    console.error('Error validating token:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 