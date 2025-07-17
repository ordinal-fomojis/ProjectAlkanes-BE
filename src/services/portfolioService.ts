import { z } from 'zod'
import { ordiscanFetch } from '../utils/ordiscan/ordiscanFetch.js'
import { UserError } from '../utils/errors.js'

// Schema for Alkane balance response from Ordiscan API
// According to docs: https://api.ordiscan.com/v1/address/{bitcoin-address}/alkanes
const alkaneBalanceSchema = z.object({
  id: z.string(), // The unique identifier of the alkane
  name: z.string().nullable(), // The name of the alkane (if available)
  symbol: z.string().nullable(), // The symbol of the alkane (if available)
  balance: z.string() // The amount of alkanes held by the address (8 decimals)
})

export interface AlkaneBalance {
  id: string
  name: string | null
  symbol: string | null
  balance: string // Keep as string since API returns string with 8 decimals
}

export interface PortfolioData {
  address: string
  alkanes: AlkaneBalance[]
}

export class PortfolioService {
  /**
   * Get Alkane address balance from Ordiscan API
   * @param address - Bitcoin address to get balance for
   * @returns Portfolio data with Alkane balances
   */
  async getAlkaneAddressBalance(address: string): Promise<PortfolioData> {
    try {
      // Validate address format (basic validation)
      if (!address || typeof address !== 'string') {
        throw new UserError('Invalid address provided').withStatus(400)
      }

      // Clean the address
      const cleanAddress = address.trim().toLowerCase()

      // Fetch balance from Ordiscan API using correct endpoint
      // GET /v1/address/{bitcoin-address}/alkanes
      const alkanes = await ordiscanFetch(
        z.array(alkaneBalanceSchema),
        `address/${cleanAddress}/alkanes`
      )

      return {
        address: cleanAddress,
        alkanes: alkanes || []
      }
    } catch (error) {
      if (error instanceof UserError) {
        throw error
      }

      // Handle Ordiscan API errors
      if (error instanceof Error) {
        if (error.message.includes('404') || error.message.includes('not found')) {
          // Return empty portfolio instead of error for addresses with no balances
          return {
            address: address.trim().toLowerCase(),
            alkanes: []
          }
        }
        if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
          throw new UserError('Rate limit exceeded, please try again later').withStatus(429)
        }
      }

      throw new UserError('Failed to fetch portfolio data').withStatus(500)
    }
  }
} 