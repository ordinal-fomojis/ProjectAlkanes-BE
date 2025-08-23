import { ObjectId } from "mongodb"
import { DatabaseCollection } from "../database/collections.js"
import { EncryptedWif } from "../utils/wif/encryptWif.js"
import { BaseService } from "./BaseService.js"

export interface UnsignedAlkaneMintTransaction {
  psbt: string
  encryptedWif: EncryptedWif
  serviceFee: number
  networkFee: number
  paddingCost: number
  totalCost: number
  networkFeePerMint: number
  networkFeeOfFinalMint: number
  mintsInEachOutput: number[]
  alkaneId: string
  mintCount: number
  paymentAddress: string
  receiveAddress: string
  authenticatedUserAddress: string
  created: Date
}

export class UnsignedAlkaneMintTransactionService extends BaseService<UnsignedAlkaneMintTransaction> {
  collectionName = DatabaseCollection.UnsignedAlkaneMintTransactions

  async createMintTransaction(mintTx: Omit<UnsignedAlkaneMintTransaction, 'created' | 'totalCost'>) {
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
