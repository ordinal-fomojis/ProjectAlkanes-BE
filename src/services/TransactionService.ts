import { Transaction } from "bitcoinjs-lib"
import { ClientSession, ObjectId } from "mongodb"
import { BaseService } from "./BaseService.js"

export interface TransactionDetails {
  wif?: string
  txid: string
  base64: string
  broadcast: boolean
  // A transaction is mined if it is in a confirmed block. It is confirmed after it has six or more confirmations.
  mined: boolean
  confirmed: boolean
  mintTx?: ObjectId
  created: Date
}

interface CreateTransactionsForMintArgs {
  txns: Transaction[]
  wif: string
  mintTx: ObjectId
}

export class TransactionService extends BaseService<TransactionDetails> {
  collectionName = 'transactions'
  
  async createTransactionsForMint({ txns, wif, mintTx }: CreateTransactionsForMintArgs, session?: ClientSession) {
    await this.collection.insertMany(txns.map(tx => ({
      txid: tx.getId(),
      base64: tx.toHex(),
      broadcast: false,
      mined: false,
      confirmed: false,
      wif,
      mintTx,
      created: new Date(),
    })), { session })
  }
}
