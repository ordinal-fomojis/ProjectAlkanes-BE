import { ORDISCAN_API_KEY, ORDISCAN_API_URL } from '../config/env.js'
import { retrySchemaFetch } from '../utils/retryFetch.js'
import { z } from 'zod'

// Ordiscan API response schemas
const OrdiscanAlkaneBalanceSchema = z.object({
  name: z.string(),
  balance: z.string()
})

const OrdiscanBrc20BalanceSchema = z.object({
  ticker: z.string(),
  balance: z.string()
})

const OrdiscanAlkaneAddressResponseSchema = z.object({
  data: z.array(OrdiscanAlkaneBalanceSchema)
})

const OrdiscanBrc20AddressResponseSchema = z.object({
  data: z.array(OrdiscanBrc20BalanceSchema)
})

export interface AlkaneBalance {
  id: string // The unique identifier of the alkane (name)
  name: string | null // The name of the alkane
  symbol: string | null // The symbol of the alkane (if available)
  balance: string // The amount of alkanes held (8 decimals)
}

export interface Brc20Balance {
  id: string // The unique identifier of the BRC-20 token (ticker)
  name: string | null // The name of the BRC-20 token
  symbol: string | null // The symbol/ticker of the BRC-20 token
  balance: string // The amount of BRC-20 tokens held (8 decimals)
}

export interface PortfolioData {
  address: string
  alkanes: AlkaneBalance[]
  brc20: Brc20Balance[]
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
        OrdiscanAlkaneAddressResponseSchema,
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
   * Get BRC-20 token balances for a specific Bitcoin address
   */
  async getBrc20Balances(address: string): Promise<Brc20Balance[]> {
    try {
      const url = `${this.baseUrl}/v1/address/${address}/brc-20`
      
      const response = await retrySchemaFetch(
        OrdiscanBrc20AddressResponseSchema,
        url,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      )

      // Transform Ordiscan response to our internal format
      return response.data.map((brc20) => ({
        id: brc20.ticker,
        name: brc20.ticker,
        symbol: brc20.ticker, // For BRC-20, the ticker is the symbol
        balance: brc20.balance
      }))
    } catch (error) {
      console.error(`Error fetching BRC-20 balances for address ${address}:`, error)
      
      // If it's a 404 (no BRC-20 tokens found), return empty array
      if (error instanceof Error && error.message.includes('404')) {
        return []
      }
      
      throw new Error(`Failed to fetch BRC-20 balances: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get complete portfolio data for a Bitcoin address (alkanes + BRC-20)
   */
  async getPortfolio(address: string): Promise<PortfolioData> {
    // Fetch both alkanes and BRC-20 balances concurrently
    const [alkanes, brc20] = await Promise.all([
      this.getAlkaneBalances(address),
      this.getBrc20Balances(address)
    ])
    
    return {
      address,
      alkanes,
      brc20
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

  /**
   * Check if an address has any BRC-20 tokens
   */
  async hasBrc20(address: string): Promise<boolean> {
    try {
      const balances = await this.getBrc20Balances(address)
      return balances.length > 0
    } catch (error) {
      console.error(`Error checking BRC-20 existence for address ${address}:`, error)
      return false
    }
  }

  /**
   * Check if an address has any tokens (alkanes or BRC-20)
   */
  async hasAnyTokens(address: string): Promise<boolean> {
    try {
      const [hasAlkanes, hasBrc20] = await Promise.all([
        this.hasAlkanes(address),
        this.hasBrc20(address)
      ])
      return hasAlkanes || hasBrc20
    } catch (error) {
      console.error(`Error checking token existence for address ${address}:`, error)
      return false
    }
  }
}
