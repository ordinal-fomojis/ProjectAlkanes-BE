import { ORDISCAN_API_KEY, ORDISCAN_API_URL } from '../config/env.js'
import { retrySchemaFetch } from '../utils/retryFetch.js'
import { z } from 'zod'

// Ordiscan API response schemas
const OrdiscanAlkaneBalanceSchema = z.object({
  name: z.string(),
  balance: z.string()
})

const OrdiscanAddressResponseSchema = z.object({
  data: z.array(OrdiscanAlkaneBalanceSchema)
})

export interface AlkaneBalance {
  id: string // The unique identifier of the alkane (name)
  name: string | null // The name of the alkane
  symbol: string | null // The symbol of the alkane (if available)
  balance: string // The amount of alkanes held (8 decimals)
}

export interface PortfolioData {
  address: string
  alkanes: AlkaneBalance[]
}

export class PortfolioService {
  private apiKey: string
  private baseUrl: string

  constructor() {
    this.apiKey = ORDISCAN_API_KEY()
    this.baseUrl = ORDISCAN_API_URL()
    
    if (!this.apiKey) {
      throw new Error('ORDISCAN_API_KEY is required for portfolio functionality')
    }
  }

  /**
   * Get alkane balances for a specific Bitcoin address
   */
  async getAlkaneBalances(address: string): Promise<AlkaneBalance[]> {
    try {
      const url = `${this.baseUrl}/v1/address/${address}/alkanes`
      
      const response = await retrySchemaFetch(
        OrdiscanAddressResponseSchema,
        url,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      )

      // Transform Ordiscan response to our internal format
      return response.data.map((alkane) => ({
        id: alkane.name,
        name: alkane.name,
        symbol: alkane.name, // For alkanes, the name is typically the symbol
        balance: alkane.balance
      }))
    } catch (error) {
      console.error(`Error fetching alkane balances for address ${address}:`, error)
      
      // If it's a 404 (no alkanes found), return empty array
      if (error instanceof Error && error.message.includes('404')) {
        return []
      }
      
      throw new Error(`Failed to fetch alkane balances: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get complete portfolio data for a Bitcoin address
   */
  async getPortfolio(address: string): Promise<PortfolioData> {
    const alkanes = await this.getAlkaneBalances(address)
    
    return {
      address,
      alkanes
    }
  }

  /**
   * Check if an address has any alkane tokens
   */
  async hasAlkanes(address: string): Promise<boolean> {
    try {
      const balances = await this.getAlkaneBalances(address)
      return balances.length > 0
    } catch (error) {
      console.error(`Error checking alkane existence for address ${address}:`, error)
      return false
    }
  }
}
