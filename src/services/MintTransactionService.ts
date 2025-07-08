import { ClientSession } from "mongodb"
import { BaseService } from "./BaseService.js"

export interface MintTransaction {
  wif: string
  serviceFee: number
  networkFee: number
  paddingCost: number
  totalCost: number
  paymentTxid: string
  alkaneId: string
  mintCount: number
  paymentAddress: string
  receiveAddress: string
  txids: string[]
  created: Date
}

export class MintTransactionService extends BaseService<MintTransaction> {
  collectionName = 'mint_transactions'

  async createMintTransaction(mintTx: Omit<MintTransaction, 'created'>, session?: ClientSession) {
    const { insertedId } = await this.collection.insertOne({
      ...mintTx,
      created: new Date(),
    }, { session })

    return insertedId
  }
}
