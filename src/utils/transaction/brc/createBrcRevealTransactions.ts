import { Signer, Transaction } from "bitcoinjs-lib"
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
  ticker: string
  decimal: number
  key: Signer
}

export function createBrcRevealTransactions({
  paymentTx, receiveAddress, mintAmount, mintCount, ticker, decimal, key
}: CreateBrcUserTransactionArgs) {
  const inscriptionContent = getBrcMintInscriptionContent(ticker, decimal, mintAmount)
  const padding = dustLimit(getAddressType(receiveAddress))
  const file: InscriptionOutput = {
    destination: receiveAddress, padding, contents: inscriptionContent
  }
  const payment = createRevealPayment(key, [file])

  const txid = paymentTx.getId()
  return paymentTx.outs.slice(0, mintCount).map((output, index) =>
    createRevealTransaction(payment, [file], key, { hash: txid, index, value: output.value }))
}
