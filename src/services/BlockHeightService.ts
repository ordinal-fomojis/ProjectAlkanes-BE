import { BaseService } from "./BaseService.js"

export interface BlockHeight {
  height: number
  synced: boolean
  // If block is not synced, timestamp is not necessarily accurate
  timestamp: Date
}

export class BlockHeightService extends BaseService<BlockHeight> {
  collectionName = 'block_heights'

  async getBlockHeight() {
    return await this.collection.find().sort({ height: 'desc' }).limit(1).next()
  }

  async getUnsyncedBlocks() {
    const unsyncedBlocks = await this.collection.find({ synced: false }).toArray()
    return unsyncedBlocks.map(block => block.height)
  }

  async setBlockHeights(heights: BlockHeight[]) {
    await this.collection.bulkWrite(heights.map(height => ({
      updateOne: {
        filter: { height: height.height },
        update: { $set: height },
        upsert: true
      }
    })))
  }
}
