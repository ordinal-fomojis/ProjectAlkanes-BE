import { Request, Response, Router } from 'express'
import { PortfolioService } from '../services/portfolioService.js'
import { validateAddress } from '../validation/portfolioValidation.js'
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth.js'

const router = Router()
const portfolioService = new PortfolioService()

/**
 * GET /api/portfolio/me
 * Get Alkane portfolio for the authenticated user's wallet address
 */
router.get('/me', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.walletAddress) {
      res.status(400).json({
        success: false,
        message: 'User wallet address not found'
      })
      return
    }

    const portfolio = await portfolioService.getAlkaneAddressBalance(req.user.walletAddress)

    res.json({
      success: true,
      data: portfolio
    })
  } catch (error: any) {
    console.error('Error in getPortfolio:', error)
    
    if (error.status) {
      res.status(error.status).json({
        success: false,
        message: error.message
      })
      return
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

/**
 * GET /api/portfolio/:address
 * Get Alkane portfolio for a specific address (for testing purposes)
 */
router.get('/:address', async (req: Request, res: Response): Promise<void> => {
  try {
    const { address } = req.params

    if (!address) {
      res.status(400).json({
        success: false,
        message: 'Address parameter is required'
      })
      return
    }

    // Validate address format
    const validationResult = validateAddress(address)
    if (!validationResult.isValid) {
      res.status(400).json({
        success: false,
        message: `Invalid address: ${address} - ${validationResult.error}`
      })
      return
    }

    const portfolio = await portfolioService.getAlkaneAddressBalance(address)

    res.json({
      success: true,
      data: portfolio
    })
  } catch (error: any) {
    
    if (error.status) {
      res.status(error.status).json({
        success: false,
        message: error.message
      })
      return
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

export default router 