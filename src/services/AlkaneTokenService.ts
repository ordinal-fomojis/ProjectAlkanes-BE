import { Document } from "mongodb"
import { DatabaseCollection } from "../database/collections.js"
import { BaseService } from "./BaseService.js"

export interface AlkaneToken {
  alkaneId: string
  name: string | null
  symbol: string | null
  logoUrl: string | null
  preminedSupply: string
  amountPerMint: string | null
  mintCountCap: string | null
  // Numeric approximation for indexing/sorting.
  // Will typically be exact, but for large values we will get numeric rounding,
  // so calculations should use mintCountCap.
  approximateMintCountCap: number | null
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
  preminedPercentage: number | null
  hasPremine: boolean
  pendingMints?: number
  mintable?: boolean
}

type SortableField = 'pendingMints' | 'deployTimestamp' | 'percentageMinted' | 'mintCountCap' | 'currentMintCount' | 'preminedPercentage'
interface SortOrder { field: SortableField, order: 'asc' | 'desc' }

interface AlkanesSearchQuery {
  searchTerm: string | null
  page: number
  pageSize: number,
  order: SortOrder
  mintable: boolean | null
  mintedOut: boolean | null
  noPremine: boolean | null
}

export class AlkaneTokenService extends BaseService<AlkaneToken> {
  collectionName = DatabaseCollection.AlkaneTokens

  async searchAlkaneTokens(
    { searchTerm, page, pageSize, order, mintable, mintedOut, noPremine }: AlkanesSearchQuery
  ): Promise<AlkaneToken[]> {
    const skip = (page - 1) * pageSize
    searchTerm = searchTerm?.trim() ?? null

    const query: Document = {}
    if (searchTerm != null && searchTerm.length > 0) {
      query.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { symbol: { $regex: searchTerm, $options: 'i' } },
        { alkaneId: { $regex: searchTerm, $options: 'i' } }
      ]
    }

    if (mintable !== null) {
      query.mintable = mintable
    }

    if (mintedOut !== null) {
      query.mintedOut = mintedOut
    }

    if (noPremine !== null) {
      query.hasPremine = !noPremine
    }

    const direction = order.order === 'asc' ? 1 : -1 as const
    const orderField = (order.field === 'mintCountCap') ? 'approximateMintCountCap' : order.field
    const sortObject = order.field === 'deployTimestamp'
      ? { [orderField]: direction } as const
      : { [orderField]: direction, deployTimestamp: -1 } as const // Newest tokens first as secondary sort

    return await this.collection
      .find(query)
      .collation({ locale: "en" })
      .sort(sortObject)
      .skip(skip)
      .limit(pageSize)
      .toArray()
  }

  async getTokensByAlkaneIds(alkaneIds: string[]) {
    // Normalize alkaneIds by trimming whitespace
    const normalizedIds = alkaneIds.map(id => id.trim())
    return await this.collection
      .find({ alkaneId: { $in: normalizedIds } })
      .toArray()
  }

  async getAlkaneById(alkaneId: string) {
    // First try exact match for performance
    let token = await this.collection.findOne({ alkaneId })
    if (token) return token

    // If exact match fails, try normalized search (trimmed)
    const normalizedId = alkaneId.trim()
    if (normalizedId !== alkaneId) {
      token = await this.collection.findOne({ alkaneId: normalizedId })
      if (token) return token
    }

    // If still no match, try case-insensitive regex search for partial matches
    // This handles cases where there might be whitespace differences or special characters
    token = await this.collection.findOne({ 
      alkaneId: { $regex: `^${normalizedId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
    })
    
    return token
  }
}
