import { Response, Router } from 'express'
import { AuthenticatedRequest, authenticateJWT } from '../middleware/auth.js'
import { AlkaneTokenService } from '../services/AlkaneTokenService.js'
import { MintTransactionService } from '../services/MintTransactionService.js'

const router = Router();

router.get('/recent-mints', (_, res) => {
  res.redirect('/api/alkane/recent-mints')
});

// Get recent mints for authenticated user
router.get('/alkane/recent-mints', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    // Get all mint transactions for the authenticated user
    // Enhanced search handles:
    // 1. NEW transactions: authenticatedUserAddress field (most reliable)
    // 2. LEGACY transactions: receiveAddress = user's ordinal address  
    // 3. SAME-ADDRESS transactions: paymentAddress = user's address (Unisat style)
    // This ensures users see ALL their transactions including historical ones
    const mintTransactions = await mintTransactionService.getMintTransactionsByWalletAddress(req.user.walletAddress, 'alkane');

    // Get all unique alkane IDs to fetch token details
    const alkaneIds = [...new Set(mintTransactions.map(mint => mint.tokenId))];
    
    // Fetch token details for all alkane IDs
    const tokens = await alkaneTokenService.getTokensByAlkaneIds(alkaneIds);

    // Create a map for quick token lookup
    const tokenMap = new Map(tokens.map(token => [token.alkaneId, token]));

    // Format the response and check confirmation status for each transaction
    const formattedMints = mintTransactions.map(mint => {
      const token = tokenMap.get(mint.tokenId);
      return {
        date: mint.created,
        mintCount: mint.mintCount,
        txid: mint.paymentTxid,
        alkaneId: mint.tokenId,
        tokenName: token?.name ?? 'Unknown Token',
        tokenSymbol: token?.symbol ?? 'UNKNOWN',
        confirmed: mint.confirmed
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

router.get('/brc/recent-mints', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.walletAddress) {
      res.status(400).json({
        success: false,
        message: 'Wallet address not found in authentication'
      });
      return;
    }

    const mintTransactionService = new MintTransactionService();

    // Get all mint transactions for the authenticated user
    // Enhanced search handles:
    // 1. NEW transactions: authenticatedUserAddress field (most reliable)
    // 2. LEGACY transactions: receiveAddress = user's ordinal address  
    // 3. SAME-ADDRESS transactions: paymentAddress = user's address (Unisat style)
    // This ensures users see ALL their transactions including historical ones
    const mintTransactions = await mintTransactionService.getMintTransactionsByWalletAddress(req.user.walletAddress, 'brc');

    // Format the response and check confirmation status for each transaction
    const formattedMints = mintTransactions.map(mint => ({
      date: mint.created,
      mintCount: mint.mintCount,
      txid: mint.paymentTxid,
      ticker: mint.tokenId,
      confirmed: mint.confirmed
    }))

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
