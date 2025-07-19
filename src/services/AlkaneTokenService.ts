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

    return await this.collection
      .find(searchQuery)
      .collation({ locale: "en" })
      .sort({ [order.field]: order.order })
      .skip(skip)
      .limit(pageSize)
      .toArray()
  }
}
