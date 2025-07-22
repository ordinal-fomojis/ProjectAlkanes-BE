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

type SortableField = 'pendingMints' | 'name' | 'symbol' | 'deployTimestamp' | 'percentageMinted' | 'mintCountCap'
interface SortOrder { field: SortableField, order: 'asc' | 'desc' }

interface AlkanesSearchQuery {
  searchTerm: string
  page: number
  pageSize: number,
  order: SortOrder
  mintable: boolean | null
  mintedOut: boolean | null
  noPremine: boolean | null
}

export class AlkaneTokenService extends BaseService<AlkaneToken> {
  collectionName = 'alkane_tokens'

  async searchAlkaneTokens(
    { searchTerm, page, pageSize, order, mintable, mintedOut, noPremine }: AlkanesSearchQuery
  ): Promise<AlkaneToken[]> {
    const skip = (page - 1) * pageSize
    searchTerm = searchTerm.trim()
    let searchQuery: Document = searchTerm.length === 0 ? {} : {
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

    if (noPremine !== null) {
      if (noPremine) {
        // Filter for tokens with no premined supply (null, undefined, or "0")
        const noPremineQuery = {
          $or: [
            { preminedSupply: { $exists: false } },
            { preminedSupply: null },
            { preminedSupply: "" },
            { preminedSupply: "0" }
          ]
        }
        
        // If we already have a search query, combine them with $and
        if (Object.keys(searchQuery).length > 0) {
          searchQuery = { $and: [searchQuery, noPremineQuery] }
        } else {
          searchQuery = noPremineQuery
        }
      }
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
