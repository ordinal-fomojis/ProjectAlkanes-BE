import { Request, Response, Router } from 'express'
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth.js'
import { validateParams } from '../middleware/validation.js'
import { PortfolioService } from '../services/PortfolioService.js'
import { walletAddressSchema } from '../validation/userValidation.js'

const router = Router()

// Get portfolio for authenticated user
router.get('/me', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.walletAddress) {
      res.status(401).json({
        success: false,
        message: 'User wallet address not found'
      })
      return
    }

    const portfolioService = new PortfolioService()
    const portfolio = await portfolioService.getPortfolio(req.user.walletAddress)
    
    res.json({
      success: true,
      message: 'Portfolio fetched successfully',
      data: portfolio
    })
  } catch (error) {
    console.error('Error fetching user portfolio:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Get portfolio for a specific address (public endpoint)
router.get('/:address', validateParams(walletAddressSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const address = req.params.address
    
    if (!address) {
      res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      })
      return
    }

    const portfolioService = new PortfolioService()
    const portfolio = await portfolioService.getPortfolio(address)
    
    res.json({
      success: true,
      message: 'Portfolio fetched successfully',
      data: portfolio
    })
  } catch (error) {
    console.error(`Error fetching portfolio for address ${req.params.address}:`, error)
    
    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message.includes('ORDISCAN_API_KEY is required')) {
        res.status(503).json({
          success: false,
          message: 'Portfolio service temporarily unavailable'
        })
        return
      }
      
      if (error.message.includes('Failed to fetch alkane balances')) {
        res.status(500).json({
          success: false,
          message: 'Failed to fetch portfolio data from external service'
        })
        return
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Check if an address has any alkanes (quick check endpoint)
router.get('/:address/has-alkanes', validateParams(walletAddressSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const address = req.params.address
    
    if (!address) {
      res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      })
      return
    }

    const portfolioService = new PortfolioService()
    const hasAlkanes = await portfolioService.hasAlkanes(address)
    
    res.json({
      success: true,
      message: 'Alkane check completed',
      data: {
        address,
        hasAlkanes
      }
    })
  } catch (error) {
    console.error(`Error checking alkanes for address ${req.params.address}:`, error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export default router
