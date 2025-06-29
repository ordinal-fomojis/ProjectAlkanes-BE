import { Transaction } from 'bitcoinjs-lib'
import { decodeAlkaneOpCallsInTransaction } from '../utils/decoder.js'
import { getMempoolTransactionIds } from '../utils/rpc/getMempoolTransactionIds.js'
import { getRawTransactions } from '../utils/rpc/getRawTransactions.js'
import { BaseService } from './BaseService.js'

const MAX_TXNS_PER_SYNC = 2000

export interface MempoolTransaction {
  txid: string
  mintId?: string
}

export class MempoolTransactionService extends BaseService<MempoolTransaction> {
  collectionName = 'mempool_transactions'

  async syncMempoolTransactions() {
    const mempoolTxIds = await getMempoolTransactionIds()
    const mempoolTxIdsSet = new Set(mempoolTxIds)

    const dbTxIds = (await this.collection.find().toArray()).map(tx => tx.txid)
    const dbTxIdsSet = new Set(dbTxIds)
    
    const newTxns = mempoolTxIds.filter(txid => !dbTxIdsSet.has(txid))

    const txnsToDelete = dbTxIds.filter(txid => !mempoolTxIdsSet.has(txid))

    if (txnsToDelete.length > 0) {
      await this.collection.deleteMany({ txid: { $in: txnsToDelete } })
    }

    const mempoolTransactions = newTxns.length === 0 ? [] : (
      await getRawTransactions(newTxns.slice(0, MAX_TXNS_PER_SYNC))).filter(x => x.success)
        .map(x => {
          const tx = Transaction.fromHex(x.response)
          const mintId = decodeAlkaneOpCallsInTransaction(tx).find(call => call.opcode === 77)?.alkaneId
          const txid = tx.getId()
          return mintId == null ? { txid } : { txid, mintId }
        }
      )

    if (mempoolTransactions.length > 0) {
      await this.collection.insertMany(mempoolTransactions)
    }

    return {
      deletedCount: txnsToDelete.length,
      createdCount: mempoolTransactions.length
    }
  }
}
