import { z } from 'zod'
import { ORDISCAN_API_KEY, ORDISCAN_API_URL } from '../config/env-vars.js'
import { AutoInstrumentedClass } from '../instrumentation/AutoInstrumentedClass.js'
import { setAttributes } from '../instrumentation/instrumentation.js'
import { bigDecimal } from '../utils/big-decimal.js'
import { retrySchemaFetch } from '../utils/retryFetch.js'
import { unisatFetch } from '../utils/unisat/unisatFetch.js'

const PAGE_SIZE = 500

const UnisatAlkaneBalanceSchema = z.object({
  total: z.number(),
  detail: z.array(z.object({
    alkaneid: z.string(),
    name: z.string(),
    symbol: z.string(),
    logo: z.string(),
    divisibility: z.number(),
    amount: z.string()
  }))
})

type UnisatAlkaneBalance = z.infer<typeof UnisatAlkaneBalanceSchema>['detail'][number]

const OrdiscanBrc20BalanceSchema = z.object({
  ticker: z.string(),
  balance: z.string()
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

export class PortfolioService extends AutoInstrumentedClass {
  private apiKey: string | undefined
  private baseUrl: string
  private isAvailable: boolean

  constructor() {
    super()
    this.apiKey = ORDISCAN_API_KEY()
    this.baseUrl = ORDISCAN_API_URL()
    this.isAvailable = !!this.apiKey
  }

  /**
   * Check if the portfolio service is available (has API key)
   */
  isServiceAvailable(): boolean {
    return this.isAvailable
  }

  /**
   * Get alkane balances for a specific Bitcoin address
   */
  async getAlkaneBalances(address: string): Promise<AlkaneBalance[]> {
    setAttributes({ address })
    
    async function getPage(page: number) {
      return await unisatFetch(UnisatAlkaneBalanceSchema, `/address/${address}/alkanes/token-list?start=${page * PAGE_SIZE}&limit=${PAGE_SIZE}`)
    }

    const alkanes: UnisatAlkaneBalance[] = []
    const { total, detail } = await getPage(0)
    alkanes.push(...detail)
    let page = 1
    while (alkanes.length < total) {
      const { detail: nextDetail } = await getPage(page)
      alkanes.push(...nextDetail)
      page++
    }

    setAttributes({ alkaneCount: alkanes.length })

    return alkanes.map((alkane) => ({
      id: alkane.alkaneid,
      name: alkane.name,
      symbol: alkane.symbol,
      balance: toAlkaneValue(alkane.amount, alkane.divisibility)
    }))
  }

  /**
   * Get BRC-20 token balances for a specific Bitcoin address
   */
  async getBrc20Balances(address: string): Promise<Brc20Balance[]> {
    if (!this.isAvailable) {
      throw new Error('Portfolio service is not available - ORDISCAN_API_KEY is missing')
    }

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

function toAlkaneValue(val: string | number, divisibility: number) {
  const divisor = new bigDecimal(10n ** BigInt(divisibility))
  return new bigDecimal(val).divide(divisor, divisibility).stripTrailingZero().getValue()
}
