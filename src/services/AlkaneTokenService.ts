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

type SortableField = 'pendingMints' | 'name' | 'symbol' | 'deployTimestamp' | 'percentageMinted' | 'mintCountCap' | 'currentMintCount' | 'preminedSupplyPercentage'
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
    
    // Build match stage for filtering
    let matchStage: Document = {}
    
    if (searchTerm.length > 0) {
      matchStage.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { symbol: { $regex: searchTerm, $options: 'i' } },
        { alkaneId: { $regex: searchTerm, $options: 'i' } }
      ]
    }

    if (mintable !== null) {
      matchStage.mintable = mintable
    }

    if (mintedOut !== null) {
      matchStage.mintedOut = mintedOut
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
        
        // If we already have a match stage, combine them with $and
        if (Object.keys(matchStage).length > 0) {
          matchStage = { $and: [matchStage, noPremineQuery] }
        } else {
          matchStage = noPremineQuery
        }
      }
    }

    // Build aggregation pipeline
    const pipeline: Document[] = [
      { $match: matchStage },
      {
        $addFields: {
          // Calculate preminedSupplyPercentage
          preminedSupplyPercentage: {
            $cond: {
              if: {
                $and: [
                  { $ne: ["$preminedSupply", null] },
                  { $ne: ["$maxSupply", null] },
                  { $ne: ["$maxSupply", "0"] },
                  { $ne: ["$maxSupply", ""] }
                ]
              },
              then: {
                $multiply: [
                  {
                    $divide: [
                      { $toDouble: "$preminedSupply" },
                      { $toDouble: "$maxSupply" }
                    ]
                  },
                  100
                ]
              },
              else: 0
            }
          }
        }
      }
    ]

    // Build sort stage
    let sortStage: Document = { [order.field]: order.order === 'asc' ? 1 : -1 }
    
    // Add secondary sort by deployTimestamp (newest first) for certain fields
    if (['pendingMints', 'currentMintCount', 'preminedSupplyPercentage'].includes(order.field)) {
      sortStage = { 
        [order.field]: order.order === 'asc' ? 1 : -1,
        deployTimestamp: -1 // Newest tokens first as secondary sort
      }
    }

    pipeline.push({ $sort: sortStage })
    pipeline.push({ $skip: skip })
    pipeline.push({ $limit: pageSize })

    return await this.collection.aggregate(pipeline).toArray() as AlkaneToken[]
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
