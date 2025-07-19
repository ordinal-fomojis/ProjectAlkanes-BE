import { z } from 'zod'
import { MEMPOOL_API_URL } from '../config/constants.js'
import { retrySchemaFetch } from '../utils/retryFetch.js'

// Schema for the mempool fees API response
const FeesResponseSchema = z.object({
  fastestFee: z.number(),
  halfHourFee: z.number(),
  hourFee: z.number(),
  economyFee: z.number(),
  minimumFee: z.number()
})

export type FeesData = z.infer<typeof FeesResponseSchema>

export class FeeService {
  private static instance: FeeService
  private cachedFees: FeesData | null = null
  private lastFetchTime = 0
  private isInitialized = false
  private fetchInterval: NodeJS.Timeout | null = null

  constructor() {
    if (FeeService.instance) {
      return FeeService.instance
    }
    FeeService.instance = this
  }

  /**
   * Initialize the fee service and start periodic fetching
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    console.log('🚀 Initializing FeeService...')
    
    // Fetch fees immediately on startup
    try {
      await this.fetchFees()
      console.log('✅ Initial fee fetch successful')
    } catch (error) {
      console.error('❌ Initial fee fetch failed:', error)
      // Set default fees if initial fetch fails
      this.setDefaultFees()
    }

    // Start periodic fetching every 30 seconds
    this.fetchInterval = setInterval(async () => {
      try {
        await this.fetchFees()
        console.log('📡 Fees updated successfully')
      } catch (error) {
        console.error('❌ Periodic fee fetch failed:', error)
      }
    }, 30 * 1000) // 30 seconds

    this.isInitialized = true
    console.log('✅ FeeService initialized with 30-second periodic updates')
  }

  /**
   * Stop the periodic fee fetching
   */
  destroy(): void {
    if (this.fetchInterval) {
      clearInterval(this.fetchInterval)
      this.fetchInterval = null
    }
    this.isInitialized = false
    console.log('🛑 FeeService destroyed')
  }

  /**
   * Fetch fees from the mempool API
   */
  private async fetchFees(): Promise<void> {
    const response = await retrySchemaFetch(
      FeesResponseSchema, 
      `${MEMPOOL_API_URL}/api/v1/fees/recommended`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AMP-Backend/1.0.0'
        }
      }
    )

    this.cachedFees = response
    this.lastFetchTime = Date.now()
  }

  /**
   * Set default fees as fallback
   */
  private setDefaultFees(): void {
    this.cachedFees = {
      fastestFee: 20,
      halfHourFee: 15,
      hourFee: 10,
      economyFee: 5,
      minimumFee: 1
    }
    this.lastFetchTime = Date.now()
    console.log('⚠️ Using default fees as fallback')
  }

  /**
   * Get cached fees
   */
  getCachedFees(): FeesData | null {
    return this.cachedFees
  }

  /**
   * Get fees with metadata
   */
  getFeesWithMetadata(): {
    fees: FeesData | null
    lastUpdated: Date | null
    cacheAge: number | null
  } {
    return {
      fees: this.cachedFees,
      lastUpdated: this.lastFetchTime ? new Date(this.lastFetchTime) : null,
      cacheAge: this.lastFetchTime ? Date.now() - this.lastFetchTime : null
    }
  }

  /**
   * Force fetch fees (bypass cache)
   */
  async forceFetchFees(): Promise<FeesData> {
    await this.fetchFees()
    if (!this.cachedFees) {
      throw new Error('Failed to fetch fees')
    }
    return this.cachedFees
  }

  /**
   * Check if fees are available
   */
  isFeesAvailable(): boolean {
    return this.cachedFees !== null
  }

  /**
   * Get singleton instance
   */
  static getInstance(): FeeService {
    if (!FeeService.instance) {
      FeeService.instance = new FeeService()
    }
    return FeeService.instance
  }
} 
