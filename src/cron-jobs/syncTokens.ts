import { database } from "../config/database.js"
import { AlkaneTokenService } from "../services/AlkaneTokenService.js"

export async function syncTokens() {
  if (!database.isConnected) return
  
  console.log('Starting token synchronization...')
  const {
    blocksSynced, tokensInBlocks, newTokens, syncedTokens, failedToSync
  } = await new AlkaneTokenService().sync()
  console.log(`Token synchronization complete:
    - Blocks synced: ${blocksSynced}
    - Tokens in blocks: ${tokensInBlocks}
    - New tokens fetched: ${newTokens}
    - Tokens synced: ${syncedTokens}
    - Failed to sync tokens: ${failedToSync}`)
}
