import { Signer, Transaction } from "bitcoinjs-lib"
import { BrcToken } from "../../../services/BrcTokenService.js"
import { createRevealPayment } from "../inscribe/createRevealPayment.js"
import { createRevealTransaction, InscriptionOutput } from "../inscribe/createRevealTransaction.js"
import { dustLimit } from "../utils/dustLimit.js"
import getAddressType from "../utils/getAddressType.js"
import { getBrcMintInscriptionContent } from "./getBrcMintInscriptionContent.js"

interface CreateBrcUserTransactionArgs {
  paymentTx: Transaction
  receiveAddress: string
  mintAmount: string
  mintCount: number
  key: Signer
  token: Pick<BrcToken, 'ticker' | 'decimal' | 'limit'>
}

export function createBrcRevealTransactions({
  paymentTx, receiveAddress, mintAmount, mintCount, key, token
}: CreateBrcUserTransactionArgs) {
  const { content } = getBrcMintInscriptionContent(token, mintAmount)
  const padding = dustLimit(getAddressType(receiveAddress))
  const file: InscriptionOutput = {
    destination: receiveAddress, padding, content
  }
  const payment = createRevealPayment(key, [file])

  const txid = paymentTx.getId()
  return paymentTx.outs.slice(0, mintCount).map((output, index) =>
    createRevealTransaction(payment, [file], key, { hash: txid, index, value: output.value }))
}
