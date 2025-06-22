import { MempoolTransactionService } from "../services/MempoolTransactionService.js"

export async function syncMempoolTransactions() {
  console.log('Starting mempool transactions synchronization...')
  const service = new MempoolTransactionService()
  const result = await service.syncMempoolTransactions()
  console.log(`Deleted ${result.deletedCount} transactions, created ${result.createdCount} new transactions in the mempool.`)
}
