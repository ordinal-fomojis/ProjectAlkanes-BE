import { ObjectId } from "mongodb"
import { DatabaseCollection } from "../database/collections.js"
import { BaseService } from "./BaseService.js"

export interface UnsignedBrcMintTransaction {
  psbt: string
  wif: string
  serviceFee: number
  networkFee: number
  paddingCost: number
  totalCost: number
  paymentAddress: string
  receiveAddress: string
  mintCount: number
  authenticatedUserAddress: string
  created: Date
}

export class UnsignedBrcMintTransactionService extends BaseService<UnsignedBrcMintTransaction> {
  collectionName = DatabaseCollection.UnsignedBrcMintTransactions

  async createMintTransaction(mintTx: Omit<UnsignedBrcMintTransaction, 'created' | 'totalCost'>) {
    const { insertedId } = await this.collection.insertOne({
      ...mintTx,
      created: new Date(),
      totalCost: mintTx.serviceFee + mintTx.networkFee + mintTx.paddingCost,
    })

    return insertedId.toString()
  }

  async getMintTransactionById(id: string) {
    return await this.collection.findOne({ _id: new ObjectId(id) })
  }
}
