import { getBlockHeight } from "../utils/getBlockHeight.js"
import { BaseService } from "./BaseService.js"
import { BlockHeightService } from "./BlockHeightService.js"

interface AlkaneToken {
  alkaneId: string
  name: string
  symbol: string
  logoUrl: string
  type: string
  preminedSupply: string
  amountPerMint: string
  mintCountCap: string
  deployTxid: string
  deployTimestamp: string
}

export class AlkaneTokenService extends BaseService<AlkaneToken> {
  collectionName = 'alkane_tokens'

  async syncTokens() {
    const blockHeightService = new BlockHeightService()
    const lastSyncBlockHeight = await blockHeightService.getBlockHeight('token_sync')

    if (lastSyncBlockHeight === null) {
      return await this.fullSync()
    }

    const currentBlockHeight = await getBlockHeight()
    
    if (currentBlockHeight === lastSyncBlockHeight) return

    await this.partialSync(lastSyncBlockHeight, currentBlockHeight)
  }

  private async fullSync() {
    return
  }

  private async partialSync(lastSyncBlockHeight: number, currentBlockHeight: number) {
    return [lastSyncBlockHeight, currentBlockHeight]
  }
}
