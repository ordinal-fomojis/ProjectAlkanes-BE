import { Response, Router } from 'express'
import { AuthenticatedRequest, authenticateJWT } from '../middleware/auth.js'
import { AlkaneTokenService } from '../services/AlkaneTokenService.js'
import { MintTransactionService } from '../services/MintTransactionService.js'
import { TransactionConfirmationService } from '../services/TransactionConfirmationService.js'

const router = Router();

// Get recent mints for authenticated user
router.get('/recent-mints', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.walletAddress) {
      res.status(400).json({
        success: false,
        message: 'Wallet address not found in authentication'
      });
      return;
    }

    const mintTransactionService = new MintTransactionService();
    const alkaneTokenService = new AlkaneTokenService();
    const transactionConfirmationService = new TransactionConfirmationService();

    // Get all mint transactions for the authenticated user
    // Enhanced search handles:
    // 1. NEW transactions: authenticatedUserAddress field (most reliable)
    // 2. LEGACY transactions: receiveAddress = user's ordinal address  
    // 3. SAME-ADDRESS transactions: paymentAddress = user's address (Unisat style)
    // This ensures users see ALL their transactions including historical ones
    const mintTransactions = await mintTransactionService.getMintTransactionsByWalletAddress(req.user.walletAddress);

    // Get all unique alkane IDs to fetch token details
    const alkaneIds = [...new Set(mintTransactions.map(mint => mint.alkaneId))];
    
    // Fetch token details for all alkane IDs
    const tokens = await alkaneTokenService.getTokensByAlkaneIds(alkaneIds);

    // Create a map for quick token lookup
    const tokenMap = new Map(tokens.map(token => [token.alkaneId, token]));

    // Format the response and check confirmation status for each transaction
    const formattedMints = await Promise.all(mintTransactions.map(async (mint) => {
      const token = tokenMap.get(mint.alkaneId);
      
      // Check confirmation status for the payment transaction
      let confirmed = false;
      try {
        const confirmationResult = await transactionConfirmationService.checkTransactionConfirmation(mint.paymentTxid);
        confirmed = confirmationResult.confirmed;
      } catch (error) {
        // If we can't check confirmation, assume it's not confirmed
        console.warn(`Failed to check confirmation for txid ${mint.paymentTxid}:`, error);
        confirmed = false;
      }

      return {
        date: mint.created,
        mintCount: mint.mintCount,
        txid: mint.paymentTxid,
        alkaneId: mint.alkaneId,
        tokenName: token?.name || 'Unknown Token',
        tokenSymbol: token?.symbol || 'UNKNOWN',
        confirmed: confirmed
      };
    }));

    res.status(200).json({
      success: true,
      message: 'Successfully fetched recent mints',
      data: formattedMints
    });

  } catch (error) {
    console.error('Error fetching recent mints:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 
