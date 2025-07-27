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
  preminedSupplyPercentage: number | null
  hasPremine: boolean
  pendingMints?: number
  mintable?: boolean
}

type SortableField = 'pendingMints' | 'deployTimestamp' | 'percentageMinted' | 'mintCountCap' | 'currentMintCount' | 'preminePercentage'
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
  collectionName = DatabaseCollection.AlkaneTokens

  async searchAlkaneTokens(
    { searchTerm, page, pageSize, order, mintable, mintedOut, noPremine }: AlkanesSearchQuery
  ): Promise<AlkaneToken[]> {
    const skip = (page - 1) * pageSize
    searchTerm = searchTerm.trim()
    
    const query: Document = {}
    if (searchTerm.length > 0) {
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
      query.noPremine = noPremine
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

  async getTokensByAlkaneIds(alkaneIds: string[]) {
    return await this.collection
      .find({ alkaneId: { $in: alkaneIds } })
      .toArray()
  }

  async getAlkaneById(alkaneId: string): Promise<AlkaneToken | null> {
    return await this.collection.findOne({ alkaneId })
  }
}
