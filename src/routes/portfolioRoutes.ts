import { Request, Response, Router } from 'express'
import z from 'zod'
import { setAttributes } from '../instrumentation/instrumentation.js'
import { AuthenticatedRequest, authenticateJWT } from '../middleware/auth.js'
import { PortfolioService } from '../services/PortfolioService.js'
import { parse } from '../utils/parse.js'
import { AddressSchema } from '../validation/userValidation.js'

const router = Router()

// Get portfolio for authenticated user
router.get('/me', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user?.walletAddress) {
    res.status(401).json({
      success: false,
      message: 'User wallet address not found'
    })
    return
  }

  setAttributes({ address: req.user.walletAddress })

  const portfolioService = new PortfolioService()
  const portfolio = await portfolioService.getPortfolio(req.user.walletAddress)

  setAttributes({ alkaneCount: portfolio.alkanes.length, brc20Count: portfolio.brc20.length })
  
  res.json({
    success: true,
    message: 'Portfolio fetched successfully',
    data: portfolio
  })
})

// Get portfolio for a specific address (public endpoint)
router.get('/:address', async (req: Request, res: Response): Promise<void> => {
  const { address } = parse(z.object({ address: AddressSchema }), req.params)

  setAttributes({ address })

  const portfolioService = new PortfolioService()
  const portfolio = await portfolioService.getPortfolio(address)

  setAttributes({ alkaneCount: portfolio.alkanes.length, brc20Count: portfolio.brc20.length })
  
  res.json({
    success: true,
    message: 'Portfolio fetched successfully',
    data: portfolio
  })
})

// Check if an address has any alkanes (quick check endpoint)
router.get('/:address/has-alkanes', async (req: Request, res: Response): Promise<void> => {
  const { address } = parse(z.object({ address: AddressSchema }), req.params);

  setAttributes({ address })

  const portfolioService = new PortfolioService()
  const hasAlkanes = await portfolioService.hasAlkanes(address)

  setAttributes({ result: hasAlkanes })
  
  res.json({
    success: true,
    message: 'Alkane check completed',
    data: {
      address,
      hasAlkanes
    }
  })
})

// Check if an address has any BRC-20 tokens (quick check endpoint)
router.get('/:address/has-brc20', async (req: Request, res: Response): Promise<void> => {
  const { address } = parse(z.object({ address: AddressSchema }), req.params);

  setAttributes({ address })

  const portfolioService = new PortfolioService()
  const hasBrc20 = await portfolioService.hasBrc20(address)

  setAttributes({ result: hasBrc20 })
  
  res.json({
    success: true,
    message: 'BRC-20 check completed',
    data: {
      address,
      hasBrc20
    }
  })
})

// Check if an address has any tokens (alkanes or BRC-20)
router.get('/:address/has-tokens', async (req: Request, res: Response): Promise<void> => {
  const { address } = parse(z.object({ address: AddressSchema }), req.params);

  setAttributes({ address })

  const portfolioService = new PortfolioService()
  const hasTokens = await portfolioService.hasAnyTokens(address)

  setAttributes({ result: hasTokens })
  
  res.json({
    success: true,
    message: 'Token check completed',
    data: {
      address,
      hasTokens
    }
  })
})

export default router
