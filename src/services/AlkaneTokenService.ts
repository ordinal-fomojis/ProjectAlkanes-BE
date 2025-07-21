import { Document } from "mongodb"
import { BaseService } from "./BaseService.js"

export interface AlkaneToken {
  alkaneId: string
  name: string | null
  symbol: string | null
  logoUrl: string | null
  preminedSupply: string
  amountPerMint: string | null
  mintCountCap: string | null
  currentSupply: string
  currentMintCount: number
  deployTxid: string | null
  deployTimestamp: Date | null
  synced: boolean
  blockSyncedAt: number
  clonedFrom: string | null
  percentageMinted: number | null
  maxSupply: string | null
  mintedOut: boolean
  pendingMints?: number
  mintable?: boolean
}

type SortableField = 'pendingMints' | 'name' | 'symbol' | 'deployTimestamp' | 'percentageMinted'
interface SortOrder { field: SortableField, order: 'asc' | 'desc' }

interface AlkanesSearchQuery {
  searchTerm: string
  page: number
  pageSize: number,
  order: SortOrder
  mintable: boolean | null
  mintedOut: boolean | null
}

export class AlkaneTokenService extends BaseService<AlkaneToken> {
  collectionName = 'alkane_tokens'

  async searchAlkaneTokens(
    { searchTerm, page, pageSize, order, mintable, mintedOut }: AlkanesSearchQuery
  ): Promise<AlkaneToken[]> {
    const skip = (page - 1) * pageSize
    searchTerm = searchTerm.trim()
    const searchQuery: Document = searchTerm.length === 0 ? {} : {
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { symbol: { $regex: searchTerm, $options: 'i' } },
        { alkaneId: { $regex: searchTerm, $options: 'i' } }
      ]
    }

    if (mintable !== null) {
      searchQuery.mintable = mintable
    }

    if (mintedOut !== null) {
      searchQuery.mintedOut = mintedOut
    }

    // Build sort object with primary and secondary sorting
    let sortObject: Document = { [order.field]: order.order }
    
    // Add secondary sort by deployTimestamp (newest first) when sorting by pendingMints
    if (order.field === 'pendingMints') {
      sortObject = { 
        [order.field]: order.order,
        deployTimestamp: 'desc' // Newest tokens first as secondary sort
      }
    }

    return await this.collection
      .find(searchQuery)
      .collation({ locale: "en" })
      .sort(sortObject)
      .skip(skip)
      .limit(pageSize)
      .toArray()
  }

  async getTokensByAlkaneIds(alkaneIds: string[]) {
    return await this.collection
      .find({ alkaneId: { $in: alkaneIds } })
      .toArray()
  }

  async getAlkaneById(alkaneId: string): Promise<AlkaneToken | null> {
    return await this.collection.findOne({ alkaneId })
  }
}
