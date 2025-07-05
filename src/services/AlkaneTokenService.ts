import { Document } from "mongodb"
import { BaseService } from "./BaseService.js"

export interface AlkaneToken {
  alkaneId: string
  name: string | null
  symbol: string | null
  logoUrl: string | null
  preminedSupply: number
  amountPerMint: number | null
  mintCountCap: number | null
  currentSupply: number
  currentMintCount: number
  deployTxid: string | null
  deployTimestamp: Date | null
  synced: boolean
  blockSyncedAt: number
  pendingMints?: number
}

type SortableField = 'pendingMints' | 'name' | 'symbol' | 'deployTimestamp' | 'percentageMinted'
interface SortOrder { field: SortableField, order: 'asc' | 'desc' }

export class AlkaneTokenService extends BaseService<AlkaneToken> {
  collectionName = 'alkane_tokens'

  async searchAlkaneTokens(
    searchTerm: string, page: number, limit: number, order: SortOrder
  ): Promise<AlkaneToken[]> {
    const skip = (page - 1) * limit
    searchTerm = searchTerm.trim()
    const query: Document = searchTerm.length === 0 ? {} : {
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { symbol: { $regex: searchTerm, $options: 'i' } },
        { alkaneId: { $regex: searchTerm, $options: 'i' } }
      ]
    }

    return this.collection.find(query)
      .collation({ locale: "en" })
      .sort({ [order.field]: order.order })
      .skip(skip)
      .limit(limit)
      .toArray()
  }
}
