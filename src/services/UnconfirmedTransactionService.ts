import { Transaction } from "bitcoinjs-lib"
import { ClientSession, ObjectId } from "mongodb"
import { MOCK_BTC } from "../config/constants.js"
import { BaseService } from "./BaseService.js"

export interface TransactionDetails {
  wif?: string
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
  created: Date
}

interface CreateTransactionsForMintArgs {
  txns: {
    tx: Transaction
    txHex: string
    txid: string
    broadcasted: boolean
  }[]
  wif: string
  mintTx: ObjectId
}

export class UnconfirmedTransactionService extends BaseService<TransactionDetails> {
  collectionName = 'unconfirmed_transactions'
  
  async createTransactionsForMint({ txns, wif, mintTx }: CreateTransactionsForMintArgs, session?: ClientSession) {
    await this.collection.insertMany(txns.map(tx => ({
      txid: tx.txid,
      txHex: tx.txHex,
      broadcastFailedAtHeight: null,
      broadcastError: null,
      broadcasted: tx.broadcasted,
      mined: false,
      wif,
      mintTx,
      mock: MOCK_BTC,
      created: new Date(),
    })), { session })
  }
}
