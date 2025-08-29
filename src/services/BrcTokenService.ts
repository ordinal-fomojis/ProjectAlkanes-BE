import { Document } from "mongodb"
import { DatabaseCollection } from "../database/collections.js"
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
interface BrcSortOrder { field: BrcSortableField, order: 'asc' | 'desc' }

interface BrcSearchQuery {
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
    const sortObject = order.field === 'deployTimestamp'
      ? { [order.field]: direction } as const
      : { [order.field]: direction, deployTimestamp: -1 } as const // Newest tokens first as secondary sort

    return await this.collection
      .find(query)
      .collation({ locale: "en" })
      .sort(sortObject)
      .skip(skip)
      .limit(pageSize)
      .toArray()
  }

  async getBrcsByTicker(tickers: string[]) {
    return await this.collection
      .find({ ticker: { $in: tickers }, initialised: true })
      .toArray()
  }

  async getBrcByTicker(ticker: string) {
    return await this.collection.findOne({ ticker, initialised: true })
  }
}
