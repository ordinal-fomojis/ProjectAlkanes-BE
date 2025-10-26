import { Document } from "mongodb"
import { DatabaseCollection } from "../database/collections.js"
import { setAttributes } from "../instrumentation/instrumentation.js"
import { normaliseTicker } from "../utils/brc-ticker.js"
import { BaseService } from "./BaseService.js"

export interface BrcToken {
  ticker: string
  synced: boolean
  initialised: boolean

  selfMint: boolean
  holdersCount: number
  inscriptionNumber: number
  inscriptionId: string
  max: string
  limit: string
  minted: string
  totalMinted: string
  confirmedMinted: string
  confirmedMinted1h: string
  confirmedMinted24h: string
  decimal: number
  deployHeight: number
  completeHeight: number
  completeBlocktime: number
  inscriptionNumberStart: number
  inscriptionNumberEnd: number

  mintedOut: boolean
  mintable: boolean
  deployTimestamp: Date
  percentageMinted: number
  currentMintCount: number
  tickerLength: number
}

type BrcSortableField = 'deployTimestamp' | 'percentageMinted' | 'currentMintCount' | 'holdersCount'
type BrcSortOrder = { field: BrcSortableField, order: 'asc' | 'desc' }

type BrcSearchQuery = {
  searchTerm: string | null
  page: number
  pageSize: number,
  order: BrcSortOrder
  mintable: boolean | null
  mintedOut: boolean | null
  tickerLength: number | null
}

export class BrcTokenService extends BaseService<BrcToken> {
  collectionName = DatabaseCollection.BrcTokens

  async searchBrcTokens(
    { searchTerm, page, pageSize, order, mintable, mintedOut, tickerLength }: BrcSearchQuery
  ): Promise<BrcToken[]> {
    setAttributes({ searchTerm, page, pageSize, order, mintable, mintedOut, tickerLength })
    const skip = (page - 1) * pageSize
    searchTerm = searchTerm?.trim() ?? null
    
    const query: Document = { initialised: true }
    if (searchTerm != null && searchTerm.length > 0) {
      query.ticker = { $regex: searchTerm, $options: 'i' }
    }
    
    if (mintable !== null) {
      query.mintable = mintable
    }

    if (mintedOut !== null) {
      query.mintedOut = mintedOut
    }

    if (tickerLength != null) {
      query.tickerLength = tickerLength
    }
    
    const direction = order.order === 'asc' ? 1 : -1 as const
    
    // Use MongoDB aggregation to prioritize 6-byte tickers first
    const pipeline = [
      { $match: query },
      {
        $addFields: {
          // Create a priority field: 0 for 6-byte tickers, 1 for others
          tickerPriority: { $cond: { if: { $eq: ["$tickerLength", 6] }, then: 0, else: 1 } }
        }
      },
      {
        $sort: {
          // First sort by priority (6-byte tickers first)
          tickerPriority: 1,
          // Then by the requested field
          [order.field]: direction,
          // Finally by deployTimestamp as fallback (newest first)
          ...(order.field !== 'deployTimestamp' && { deployTimestamp: -1 })
        }
      },
      { $skip: skip },
      { $limit: pageSize },
      // Remove the temporary priority field from results
      { $unset: "tickerPriority" }
    ]

    const results = await this.collection
      .aggregate(pipeline, { collation: { locale: "en" } })
      .toArray() as BrcToken[]
    
    setAttributes({ resultCount: results.length, resultTickers: results.map(r => r.ticker) })

    return results
  }

  async getBrcsByTicker(tickers: string[]) {
    setAttributes({ tickers })
    const results = await this.collection
      .find({ ticker: { $in: tickers.map(normaliseTicker) }, initialised: true })
      .toArray()
    setAttributes({ resultCount: results.length, resultTickers: results.map(r => r.ticker) })
    return results
  }

  async getBrcByTicker(ticker: string) {
    setAttributes({ ticker })
    const result = await this.collection.findOne({ ticker: normaliseTicker(ticker), initialised: true })
    setAttributes({ result })
    return result
  }
}
