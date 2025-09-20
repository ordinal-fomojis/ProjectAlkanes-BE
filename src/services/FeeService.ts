import { ROOT_CONTEXT, context } from '@opentelemetry/api'
import { z } from 'zod'
import { MEMPOOL_API_URL } from '../config/env-vars.js'
import { recordException, setAttributes } from '../instrumentation/instrumentation.js'
import { AutoInstrumentedClass } from '../utils/AutoInstrumentedClass.js'
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
const FEE_FETCH_INTERVAL = parseInt(process.env.FEE_FETCH_INTERVAL ?? "30")

export class FeeService extends AutoInstrumentedClass {
  private static instance: FeeService
  private cachedFees: FeesData | null = null
  private lastFetchTime = 0
  private isInitialized = false
  private fetchInterval: NodeJS.Timeout | null = null

  constructor() {
    super()
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
    
    // Fetch fees immediately on startup
    try {
      await this.fetchFees()
    } catch (error) {
      recordException(error, { setStatus: false })
    }

    // Start periodic fetching every 30 seconds
    setAttributes({ feeFetchIntervalSeconds: FEE_FETCH_INTERVAL })
    context.with(ROOT_CONTEXT, async () => {
      this.fetchInterval = setInterval(() => this.fetchFees(), FEE_FETCH_INTERVAL * 1000)
    })
    this.isInitialized = true
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
  }

  /**
   * Fetch fees from the mempool API
   */
  private async fetchFees() {
    const response = await retrySchemaFetch(
      FeesResponseSchema, 
      `${MEMPOOL_API_URL()}/api/v1/fees/recommended`,
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
    return response
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
  async forceFetchFees() {
    return await this.fetchFees()
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
