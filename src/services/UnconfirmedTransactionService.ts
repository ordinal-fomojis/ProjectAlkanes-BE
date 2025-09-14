import { Transaction } from "bitcoinjs-lib"
import { ClientSession, ObjectId } from "mongodb"
import { MOCK_BTC } from "../config/env-vars.js"
import { DatabaseCollection } from "../database/collections.js"
import { EncryptedWif } from "../utils/wif/encryptWif.js"
import { BaseService } from "./BaseService.js"

export interface TransactionDetails {
  encryptedWif?: EncryptedWif
  txid: string
  txHex: string
  broadcastFailedAtHeight: number | null
  broadcastError: string | null
  broadcasted: boolean
  // A transaction is mined if it is in a confirmed block.
  // It is confirmed after it has six or more confirmations (after which it will no longer be in this dataset).
  mined: boolean
  mock: boolean
  mintTx?: ObjectId
  // random id that is identical for all transactions in a single request
  requestId: string
  created: Date
}

interface CreateTransactionsForMintArgs {
  txns: {
    tx: Transaction
    txHex: string
    txid: string
    broadcasted: boolean
  }[]
  encryptedWif: EncryptedWif
  mintTx: ObjectId
  requestId: string
}

export class UnconfirmedTransactionService extends BaseService<TransactionDetails> {
  collectionName = DatabaseCollection.UnconfirmedTransactions
  
  async createTransactionsForMint({ txns, encryptedWif, mintTx, requestId }: CreateTransactionsForMintArgs, session?: ClientSession) {
    await this.collection.insertMany(txns.map(tx => ({
      txid: tx.txid,
      txHex: tx.txHex,
      broadcastFailedAtHeight: null,
      broadcastError: null,
      broadcasted: tx.broadcasted,
      mined: false,
      mintTx,
      encryptedWif,
      mock: MOCK_BTC(),
      created: new Date(),
      requestId
    })), { session })
  }
}
