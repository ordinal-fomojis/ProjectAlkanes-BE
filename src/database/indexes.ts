import { Collection, Db, IndexDirection } from "mongodb"
import { DatabaseCollection } from "./collections.js"

type FieldIndex = Parameters<Collection['createIndex']> | Record<string, IndexDirection>
type CollectionIndex = FieldIndex[]
type Indexed = Record<DatabaseCollection, CollectionIndex>

const TokenSortableFields = [
  'percentageMinted', 'pendingMints', 'currentMintCount', 'approximateMintCountCap', 'preminedPercentage'
]

const Indexes: Indexed = {
  alkane_tokens: [
    [{ alkaneId: 1 }, { unique: true }],
    { name: 1 },
    { symbol: 1 },
    { synced: 1 },
    { deployTimestamp: 1 },
    { mintable: 1 },
    { mintedOut: 1 },
    { hasPremine: 1 },
    { clonedFrom: 1 },
    // Each of the sortable fields have a secondary sort of deployTimestamp, in both directions,
    // so that newest are always first, regardless of what sort order is chosen
    ...TokenSortableFields.flatMap(field => [
      { [field]: 1, deployTimestamp: -1 },
      { [field]: -1, deployTimestamp: -1 }
    ])
  ],
  auth_nonces: [
    { walletAddress: 1 },
  ],
  block_heights: [
    { height: 1 },
    { synced: 1 },
    [{ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 }]
  ],
  confirmed_transactions: [],
  mempool_transactions: [
    [{ txid: 1 }, { unique: true }],
    { mintId: 1 }
  ],
  mint_transactions: [],
  unconfirmed_transactions: [
    { broadcastFailedAtHeight: 1 }
  ],
  unsigned_mint_transactions: [
    [{ created: 1 }, { expireAfterSeconds: 300 }]
  ],
  users: [
    [{ walletAddress: 1 }, { unique: true }],
    { referralCode: 1 }
  ],
}

export async function initIndexes(db: Db): Promise<void> {
  for (const [collectionName, indexes] of Object.entries(Indexes)) {
    const collection = db.collection(collectionName)
    for (const index of indexes) {
      try {
        const indexName = Array.isArray(index)
          ? await collection.createIndex(...index)
          : await collection.createIndex(index)
        
        console.log(`Created index: ${indexName} in ${collectionName}`)
      } catch (error) {
        console.error(`Failed to create index on ${collectionName}:`, error)
      }
    }
  }
}
