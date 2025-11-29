import { Document } from "mongodb"
import { DatabaseCollection } from "../database/collections.js"
import { setAttributes } from "../instrumentation/instrumentation.js"
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

interface AlkaneTokenV2 {
  alkaneId: string
  name: string
  symbol: string
  logoUrl: string
  preminedSupply: string
  amountPerMint: string
  mintCountCap: string // Calculated based on preminedSupply / amountPerMint
  // Numeric approximation for indexing/sorting.
  // Will typically be exact, but for large values we will get numeric rounding,
  // so calculations should use mintCountCap.
  approximateMintCountCap: number
  currentSupply: string
  currentMintCount: number
  deployTxid: string
  deployTimestamp: Date
  synced: boolean
  initialised: boolean
  percentageMinted: number
  maxSupply: string
  mintedOut: boolean
  preminedPercentage: number
  hasPremine: boolean
  mintable: boolean
  holdersCount: number
}

type SortableField = 'pendingMints' | 'deployTimestamp' | 'percentageMinted' | 'mintCountCap' | 'currentMintCount' | 'preminedPercentage'
type SortOrder = { field: SortableField, order: 'asc' | 'desc' }

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
    return await this.collection
      .find({ alkaneId: { $in: alkaneIds } })
      .toArray()
  }

  async getAlkaneById(alkaneId: string) {
    return await this.collection.findOne({ alkaneId })
  }
}

export class AlkaneTokenV2Service extends BaseService<AlkaneTokenV2> {
  collectionName = DatabaseCollection.AlkaneTokens

  async searchAlkaneTokens(
    { searchTerm, page, pageSize, order, mintable, mintedOut, noPremine }: AlkanesSearchQuery
  ) {
    setAttributes({ searchTerm, page, pageSize, order, mintable, mintedOut, noPremine })
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

    const result = await this.collection
      .find(query)
      .collation({ locale: "en" })
      .sort(sortObject)
      .skip(skip)
      .limit(pageSize)
      .toArray()
    setAttributes({ resultCount: result.length, resultNames: result.map(r => r.name), resultIds: result.map(r => r.alkaneId) })
    return result
  }

  async getTokensByAlkaneIds(alkaneIds: string[]) {
    setAttributes({ alkaneIds })
    const result = await this.collection
      .find({ alkaneId: { $in: alkaneIds } })
      .toArray()
    setAttributes({ resultCount: result.length, resultNames: result.map(r => r.name) })
    return result
  }

  async getAlkaneById(alkaneId: string) {
    setAttributes({ alkaneId })
    const result = await this.collection.findOne({ alkaneId })
    setAttributes({ result, exists: result != null })
    return result
  }
}
