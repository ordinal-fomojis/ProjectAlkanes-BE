import { Request, Response, Router } from 'express'
import z from 'zod'
import { AuthenticatedRequest, authenticateJWT } from '../middleware/auth.js'
import { PortfolioService } from '../services/PortfolioService.js'
import { parse } from '../utils/parse.js'
import { AddressSchema } from '../validation/userValidation.js'

const router = Router()

// Health check endpoint to check if portfolio service is available
router.get('/health', async (_req: Request, res: Response): Promise<void> => {
  try {
    const portfolioService = new PortfolioService()
    const isAvailable = portfolioService.isServiceAvailable()
    
    res.json({
      success: true,
      message: 'Portfolio service health check completed',
      data: {
        service: 'portfolio',
        available: isAvailable,
        status: isAvailable ? 'operational' : 'unavailable - API key not configured'
      }
    })
  } catch (error) {
    console.error('Error checking portfolio service health:', error)
    res.status(500).json({
      success: false,
      message: 'Error checking service health',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

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
router.get('/:address', async (req: Request, res: Response): Promise<void> => {
  try {
    const { address } = parse(z.object({ address: AddressSchema }), req.params);

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
      if (error.message.includes('Portfolio service is not available') || error.message.includes('ORDISCAN_API_KEY is required')) {
        res.status(503).json({
          success: false,
          message: 'Portfolio service temporarily unavailable - API key not configured'
        })
        return
      }
      
      if (error.message.includes('Failed to fetch alkane balances') || error.message.includes('Failed to fetch BRC-20 balances')) {
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
router.get('/:address/has-alkanes', async (req: Request, res: Response): Promise<void> => {
  try {
    const { address } = parse(z.object({ address: AddressSchema }), req.params);

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

// Check if an address has any BRC-20 tokens (quick check endpoint)
router.get('/:address/has-brc20', async (req: Request, res: Response): Promise<void> => {
  try {
    const { address } = parse(z.object({ address: AddressSchema }), req.params);

    const portfolioService = new PortfolioService()
    const hasBrc20 = await portfolioService.hasBrc20(address)
    
    res.json({
      success: true,
      message: 'BRC-20 check completed',
      data: {
        address,
        hasBrc20
      }
    })
  } catch (error) {
    console.error(`Error checking BRC-20 for address ${req.params.address}:`, error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Check if an address has any tokens (alkanes or BRC-20)
router.get('/:address/has-tokens', async (req: Request, res: Response): Promise<void> => {
  try {
    const { address } = parse(z.object({ address: AddressSchema }), req.params);

    const portfolioService = new PortfolioService()
    const hasTokens = await portfolioService.hasAnyTokens(address)
    
    res.json({
      success: true,
      message: 'Token check completed',
      data: {
        address,
        hasTokens
      }
    })
  } catch (error) {
    console.error(`Error checking tokens for address ${req.params.address}:`, error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export default router
