import { Request, Response, Router } from 'express';
import { validateRequest } from '../middleware/validation.js';
import { TransactionConfirmationService } from '../services/TransactionConfirmationService.js';
import { transactionConfirmationSchema } from '../validation/transactionValidation.js';

const router = Router();

// Check transaction confirmation status
router.post('/confirmation', validateRequest(transactionConfirmationSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { txid } = req.body;
    const transactionService = new TransactionConfirmationService();
    const result = await transactionService.checkTransactionConfirmation(txid);
    
    res.status(200).json({
      success: true,
      message: 'Transaction confirmation status retrieved successfully',
      data: {
        confirmed: result.confirmed,
        txid: result.txid
      }
    });
  } catch (error) {
    console.error('Error checking transaction confirmation:', error);
    
    // Handle specific error cases
    if (error instanceof Error && error.message.includes('Request failed with error 404')) {
      res.status(404).json({
        success: false,
        message: 'Transaction not found',
        data: {
          confirmed: false,
          txid: req.body.txid
        }
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 
