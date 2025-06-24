import { BaseService } from "./BaseService.js"


interface BlockHeight {
  name: string
  height: number
}

export class BlockHeightService extends BaseService<BlockHeight> {
  protected collectionName = 'block_heights'

  async getBlockHeight(name: string): Promise<number | null> {
    const blockHeight = await this.collection.findOne({ name })
    return blockHeight?.height ?? null
  }

  async setBlockHeight(name: string, height: number): Promise<void> {
    await this.collection.updateOne(
      { name },
      { $set: { height } },
      { upsert: true }
    )
  }
}
