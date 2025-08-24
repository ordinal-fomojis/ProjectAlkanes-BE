import { ClientSession } from "mongodb"
import { DatabaseCollection } from "../database/collections.js"
import { EncryptedWif } from "../utils/wif/encryptWif.js"
import { BaseService } from "./BaseService.js"

// All transactions ever signed are stored here, even if they fail to broadcast.
// The main purpose of this is as a failsafe, in case a broadcast api request responds with an error,
// but for some reason it does actually broadcast. In this case, we discard the transaction, since it failed to
// broadcast, but we will still have it in our archive, so we can manually broadcast the subsequent
// transactions so the user can still get their tokens. We will only keep these for 30 days, and we would
// rely on a user to inform us if this happens. (mock transactions should not be stored)

export interface ArchivedTransaction {
  encryptedWif?: EncryptedWif
  txid: string
  txHex: string
  // random id that is identical for all transactions in a single request
  requestId: string
  created: Date
}

interface CreateArchivedTransactionArgs {
  txns: {
    txHex: string
    txid: string
  }[]
  encryptedWif: EncryptedWif
  requestId: string
}

export class ArchivedTransactionService extends BaseService<ArchivedTransaction> {
  collectionName = DatabaseCollection.ArchivedTransactions

  async createArchivedTransactions({ txns, encryptedWif, requestId }: CreateArchivedTransactionArgs, session?: ClientSession) {
    await this.collection.insertMany(txns.map(tx => ({
      txid: tx.txid,
      txHex: tx.txHex,
      requestId,
      encryptedWif,
      created: new Date(),
    })), { session })
  }
}
