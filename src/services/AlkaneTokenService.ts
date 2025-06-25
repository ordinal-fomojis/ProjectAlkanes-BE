import { getBlockHeight } from "../utils/rpc/getBlockHeight.js"
import { BaseService } from "./BaseService.js"
import { BlockHeightService } from "./BlockHeightService.js"

export interface AlkaneToken {
  alkaneId: string
  name: string
  symbol: string
  logoUrl: string
  preminedSupply: number
  amountPerMint: number
  mintCountCap: number
  currentSupply: number
  currentMintCount: number
  deployTxid: string
  deployTimestamp: Date
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
