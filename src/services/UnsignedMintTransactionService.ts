import { createUserTransaction } from "../utils/transaction/createUserTransaction.js"
import { getUtxos } from "../utils/transaction/getUtxos.js"
import { BaseService } from "./BaseService.js"

export interface UnsignedMintTransaction {
  psbt: string
  wif: string
  serviceFee: number
  networkFee: number
  paddingCost: number
  totalCost: number
  alkaneId: string
  mintCount: number
  paymentAddress: string
  receiveAddress: string
  createdAt: Date
}

export class UnsignedMintTransactionService extends BaseService<UnsignedMintTransaction> {
  collectionName = 'unsigned_mint_transactions'

  async getMintTransaction(
    feeRate: number, paymentAddress: string, paymentPubkey: string,
    receiveAddress: string, alkaneId: string, mintCount: number
  ) {
    // TODO: validate token is mintable, and has at least mint count mints available
    const utxos = await getUtxos(paymentAddress)
    const { psbt, internalKey, serviceFee, networkFee, paddingCost } = await createUserTransaction({
      feeRate, paymentAddress, paymentPubkey, receiveAddress, alkaneId, mintCount, utxos
    })

    const mintTx = {
      psbt: psbt.toHex(),
      wif: internalKey.toWIF(),
      serviceFee, networkFee, paddingCost,
      totalCost: serviceFee + networkFee + paddingCost,
      alkaneId, mintCount,
      paymentAddress,
      receiveAddress,
      createdAt: new Date(),
    } satisfies UnsignedMintTransaction

    const result = await this.collection.insertOne(mintTx)

    return {
      id: result.insertedId.toString(),
      psbt: mintTx.psbt,
      serviceFee: mintTx.serviceFee,
      networkFee: mintTx.networkFee,
      paddingCost: mintTx.paddingCost,
      totalCost: mintTx.totalCost,
    }
  }
}
