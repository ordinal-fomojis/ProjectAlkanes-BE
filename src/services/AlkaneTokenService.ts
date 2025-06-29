import { database } from "../config/database.js"
import { decodeAlkaneOpCallsInBlock } from "../utils/decoder.js"
import { getAlkaneIdsAfterTimestamp, getAlkaneTokens } from "../utils/ordiscan/getAlkanes.js"
import { getBlockHeight } from "../utils/rpc/getBlockHeight.js"
import { getBlockTimestamp } from "../utils/rpc/getBlockTimestamp.js"
import { getRawBlocks } from "../utils/rpc/getRawBlocks.js"
import { BaseService } from "./BaseService.js"
import { BlockHeight, BlockHeightService } from "./BlockHeightService.js"

const MAX_TOKENS_PER_SYNC = 200
const MAX_BLOCKS_PER_SYNC = 3

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
}

export class AlkaneTokenService extends BaseService<AlkaneToken> {
  collectionName = 'alkane_tokens'
  protected blockHeightService = new BlockHeightService()

  async sync() {
    const lastSyncBlockHeight = await this.blockHeightService.getBlockHeight()
    const currentBlockHeight = await getBlockHeight()
    
    const { blocksSynced, tokensUnsynced } = await this.syncBlocks(lastSyncBlockHeight?.height ?? null, currentBlockHeight)
    const { tokensFetched } = await this.fetchNewTokens(lastSyncBlockHeight, currentBlockHeight)
    const { syncedTokens, failedToSync } = await this.syncTokens(currentBlockHeight)

    if (lastSyncBlockHeight == null) {
      await this.blockHeightService.setBlockHeights([{
        height: currentBlockHeight,
        synced: true,
        timestamp: await getBlockTimestamp(currentBlockHeight),
      }])
    }

    return {
      blocksSynced,
      tokensInBlocks: tokensUnsynced,
      newTokens: tokensFetched,
      syncedTokens,
      failedToSync
    }
  }

  // Fetches unsynced blocks. Each block successfully fetched and decoded is marked as synced,
  // and any tokens interacted with in the block are unsynced.
  private async syncBlocks(lastSyncHeight: number | null, currentHeight: number) {
    // Unsynced blocks are all those since the last sync, and any marked as unsynced in the database
    const blocksSinceLastSync = lastSyncHeight == null ? []
      : Array.from({ length: currentHeight - lastSyncHeight }, (_, i) => i + lastSyncHeight + 1)
    const unsyncedBlocks = (await this.blockHeightService.getUnsyncedBlocks())
      .concat(blocksSinceLastSync).slice(0, MAX_BLOCKS_PER_SYNC)

    if (unsyncedBlocks.length === 0) return { blocksSynced: 0, tokensUnsynced: 0 }

    const blockResponses = await getRawBlocks(unsyncedBlocks)
    const tokenIds = new Set(blockResponses.filter(b => b.success)
      .flatMap(b => decodeAlkaneOpCallsInBlock(b.response))
      .flatMap(b => b.opcalls.map(o => o.alkaneId)))
    
    await database.withTransaction(async () => {
      await this.blockHeightService.setBlockHeights(blockResponses.map(b => ({
        height: b.height,
        timestamp: b.success ? new Date(b.response.timestamp * 1000) : new Date(0),
        synced: b.success
      })))
      
      await this.collection.updateMany(
        { alkaneId: { $in: Array.from(tokenIds) } },
        { $set: { synced: false } }
      )
    })
    return { blocksSynced: blockResponses.length, tokensUnsynced: tokenIds.size }
  }

  // Fetch list of alkanes after the given timestamp, or all if no timestamp is provided,
  // and save them to the database as unsynced tokens.
  private async fetchNewTokens(lastSyncedBlock: BlockHeight | null, currentBlockHeight: number) {
    if (lastSyncedBlock?.height === currentBlockHeight) return { tokensFetched: 0 }

    const alkanes = await getAlkaneIdsAfterTimestamp(lastSyncedBlock?.timestamp ?? null)
    if (alkanes.length === 0) return { tokensFetched: 0 }

    await this.collection.bulkWrite(alkanes.map(token => ({
      updateOne: {
        filter: { alkaneId: token.alkaneId },
        update: { $setOnInsert: {
          ...token,
          synced: false,
          blockSyncedAt: 0
        } },
        upsert: true
      }
    })))
    return { tokensFetched: alkanes.length }
  }

  // Syncs all tokens marked as unsynced in the database.
  private async syncTokens(currentBlockHeight: number) {
    const unsyncedTokens = await this.collection.find({ synced: false })
      .sort({ blockSyncedAt: 'asc' })
      .limit(MAX_TOKENS_PER_SYNC).toArray()

    const tokens = await getAlkaneTokens(unsyncedTokens.map(t => t.alkaneId))
    const successfulTokens = tokens.filter(r => r.status === 'fulfilled').map(r => r.value)
    tokens.filter(r => r.status === 'rejected').forEach(r => {
      console.error(`Failed to fetch alkane token: ${r.reason}`)
    })
    if (successfulTokens.length === 0) return { syncedTokens: 0, failedToSync: unsyncedTokens.length }

    await this.collection.bulkWrite(successfulTokens.map(token => ({
      updateOne: {
        filter: { alkaneId: token.alkaneId },
        update: { $set: {
          ...token,
          synced: true,
          blockSyncedAt: currentBlockHeight
        } },
        upsert: true
      }
    })))
    return { syncedTokens: successfulTokens.length, failedToSync: tokens.length - successfulTokens.length }
  }
}
