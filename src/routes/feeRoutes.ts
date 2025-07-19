import { Request, Response, Router } from 'express'
import { FeeService } from '../services/FeeService.js'

const router = Router()

// Get recommended fees (cached)
router.get('/recommended', async (_: Request, res: Response): Promise<void> => {
  try {
    const feeService = FeeService.getInstance()
    const feesData = feeService.getFeesWithMetadata()
    
    if (!feesData.fees) {
      res.status(503).json({
        success: false,
        message: 'Fee data not available yet, please try again in a moment'
      })
      return
    }

    res.status(200).json({
      success: true,
      message: 'Successfully fetched recommended fees',
      data: {
        fees: feesData.fees,
        lastUpdated: feesData.lastUpdated,
        cacheAgeMs: feesData.cacheAge
      }
    })
  } catch (error) {
    console.error('Error getting recommended fees:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Force refresh fees (admin endpoint)
router.post('/refresh', async (_: Request, res: Response): Promise<void> => {
  try {
    const feeService = FeeService.getInstance()
    const fees = await feeService.forceFetchFees()
    
    res.status(200).json({
      success: true,
      message: 'Successfully refreshed fees',
      data: {
        fees,
        lastUpdated: new Date()
      }
    })
  } catch (error) {
    console.error('Error refreshing fees:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to refresh fees',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Health check for fee service
router.get('/health', async (_: Request, res: Response): Promise<void> => {
  try {
    const feeService = FeeService.getInstance()
    const feesData = feeService.getFeesWithMetadata()
    const isHealthy = feeService.isFeesAvailable()
    const cacheAge = feesData.cacheAge || 0
    const isStale = cacheAge > 60 * 1000 // Consider stale if older than 1 minute

    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      message: isHealthy 
        ? (isStale ? 'Fee service is running but data is stale' : 'Fee service is healthy')
        : 'Fee service is not available',
      data: {
        isAvailable: isHealthy,
        isStale,
        lastUpdated: feesData.lastUpdated,
        cacheAgeMs: cacheAge
      }
    })
  } catch (error) {
    console.error('Error checking fee service health:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export default router 
