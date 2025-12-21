import { trace } from "@opentelemetry/api"
import { Collection, Db, IndexDirection } from "mongodb"
import { recordException, withSpan } from "../instrumentation/instrumentation.js"
import { DatabaseCollection } from "./collections.js"

type FieldIndex = Parameters<Collection['createIndex']> | Record<string, IndexDirection>
type CollectionIndex = FieldIndex[]
type Indexed = Record<DatabaseCollection, CollectionIndex>

const AlkaneSortableFields = [
  'percentageMinted', 'pendingMints', 'currentMintCount', 'approximateMintCountCap', 'preminedPercentage'
]

const BrcSortableFields = [
  'percentageMinted', 'currentMintCount', 'holdersCount'
]

const Indexes: Indexed = {
  alkane_tokens_v2: [
    [{ alkaneId: 1 }, { unique: true }],
    { initialised: 1, mintable: 1, mintedOut: 1, hasPremine: 1, deployTimestamp: 1 },
    { initialised: 1, mintedOut: 1, hasPremine: 1, deployTimestamp: 1 },
    { initialised: 1, hasPremine: 1, deployTimestamp: 1 },
    
    { name: 1 },
    { symbol: 1 },
    { synced: 1 },
    
    // Each of the sortable fields have a secondary sort of deployTimestamp, in both directions,
    // so that newest are always first, regardless of what sort order is chosen
    ...AlkaneSortableFields.flatMap(field => [
      { initialised: 1, mintable: 1, mintedOut: 1, hasPremine: 1, [field]: 1, deployTimestamp: -1 },
      { initialised: 1, mintable: 1, mintedOut: 1, hasPremine: 1, [field]: -1, deployTimestamp: -1 },
      { initialised: 1, mintedOut: 1, hasPremine: 1, [field]: 1, deployTimestamp: -1 },
      { initialised: 1, mintedOut: 1, hasPremine: 1, [field]: -1, deployTimestamp: -1 },
      { initialised: 1, hasPremine: 1, [field]: 1, deployTimestamp: -1 },
      { initialised: 1, hasPremine: 1, [field]: -1, deployTimestamp: -1 },
    ])
  ],
  archived_transactions: [{ created: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 /* 30 days */ }],
  auth_nonces: [
    { walletAddress: 1 },
  ],
  brc_tokens: [
    [{ ticker: 1 }, { unique: true }],
    { synced: 1 },
    { initialised: 1 },
    { deployTimestamp: 1 },
    { mintable: 1 },
    { mintedOut: 1 },
    { tickerLength: 1 },
    // Compound indexes for common query patterns with initialised filter
    { initialised: 1, mintable: 1 },
    { initialised: 1, mintedOut: 1 },
    { initialised: 1, tickerLength: 1 },
    // Compound indexes optimized for 6-byte ticker priority sorting
    // Each sortable field with tickerLength priority and deployTimestamp fallback
    ...BrcSortableFields.flatMap(field => [
      { initialised: 1, tickerLength: -1, [field]: 1, deployTimestamp: -1 },
      { initialised: 1, tickerLength: -1, [field]: -1, deployTimestamp: -1 }
    ])
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
  mint_transactions: [
    { type: 1 },
    { authenticatedUserAddress: 1 },
    { paymentAddress: 1 },
    { receiveAddress: 1 },
    { requestId: 1 }
  ],
  unconfirmed_transactions: [
    { broadcastFailedAtHeight: 1 },
    { requestId: 1 }
  ],
  unsigned_alkane_mint_transactions: [
    [{ created: 1 }, { expireAfterSeconds: 300 }]
  ],
  unsigned_brc_mint_transactions: [
    [{ created: 1 }, { expireAfterSeconds: 300 }]
  ],
  users: [
    [{ walletAddress: 1 }, { unique: true }],
    { referralCode: 1 }
  ],
}

const tracer = trace.getTracer('indexes')
export const initIndexes = withSpan(tracer, 'initIndexes', async (db: Db) => {
  for (const [collectionName, indexes] of Object.entries(Indexes)) {
    const collection = db.collection(collectionName)
    for (const index of indexes) {
      try {
        if (Array.isArray(index)) {
          await collection.createIndex(...index)
        } else {
          await collection.createIndex(index)
        }
      } catch (error) {
        recordException(error)
      }
    }
  }
})
