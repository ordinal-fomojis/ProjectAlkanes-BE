import { Response, Router } from 'express'
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth.js'
import { MintTransactionService } from '../services/MintTransactionService.js'
import { AlkaneTokenService } from '../services/AlkaneTokenService.js'

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

    // Get all mint transactions for the authenticated user's wallet
    const mintTransactions = await mintTransactionService.getMintTransactionsByPaymentAddress(req.user.walletAddress);

    // Get all unique alkane IDs to fetch token details
    const alkaneIds = [...new Set(mintTransactions.map(mint => mint.alkaneId))];
    
    // Fetch token details for all alkane IDs
    const tokens = await alkaneTokenService.getTokensByAlkaneIds(alkaneIds);

    // Create a map for quick token lookup
    const tokenMap = new Map(tokens.map(token => [token.alkaneId, token]));

    // Format the response
    const formattedMints = mintTransactions.map(mint => {
      const token = tokenMap.get(mint.alkaneId);
      return {
        date: mint.created,
        mintCount: mint.mintCount,
        txid: mint.paymentTxid,
        alkaneId: mint.alkaneId,
        tokenName: token?.name || 'Unknown Token',
        tokenSymbol: token?.symbol || 'UNKNOWN'
      };
    });

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