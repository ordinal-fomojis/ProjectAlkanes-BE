import { Psbt } from "bitcoinjs-lib"
import { MIN_FEE_RATE } from "../../../config/constants.js"
import { RECEIVE_ADDRESS } from "../../../config/env.js"
import { Utxo } from "../getUtxos.js"
import { createRevealPayment } from "../inscribe/createRevealPayment.js"
import { createRevealTransaction, InscriptionOutput } from "../inscribe/createRevealTransaction.js"
import { calculateTransactionInputsAndFee } from "../utils/calculateTransactionInputsAndFee.js"
import { dustLimit } from "../utils/dustLimit.js"
import getAddressType from "../utils/getAddressType.js"
import { randomKey } from "../utils/keys.js"
import { BTC_JS_NETWORK } from "../utils/network.js"
import { randomTransactionId } from "../utils/randomTransactionId.js"
import { getBrcMintServiceFee } from "../utils/service-fee.js"
import { getBrcMintInscriptionContent } from "./getBrcMintInscriptionContent.js"

interface CreateBrcUserTransactionArgs {
  feeRate: number
  paymentAddress: string
  paymentPubkey: string
  receiveAddress: string
  mintAmount: string
  mintCount: number
  ticker: string
  decimal: number
  utxos: Utxo[]
}

export async function createBrcUserTransaction({
  feeRate, paymentAddress, paymentPubkey, receiveAddress, mintAmount, mintCount, ticker, decimal, utxos
}: CreateBrcUserTransactionArgs) {
  feeRate = Math.max(feeRate, MIN_FEE_RATE)
  const inscriptionContent = getBrcMintInscriptionContent(ticker, decimal, mintAmount)

  const serviceFee = getBrcMintServiceFee(mintCount)
  const padding = dustLimit(getAddressType(receiveAddress))

  const internalKey = randomKey()

  const file: InscriptionOutput = {
    destination: receiveAddress, padding, contents: inscriptionContent
  }
  const payment = createRevealPayment(internalKey, [file])

  const dummyInput = { hash: randomTransactionId(), index: 0, value: padding }

  const reveal = createRevealTransaction(payment, [file], internalKey, dummyInput)
  const virtualSize = reveal.virtualSize()
  const outputValue = reveal.outs.reduce((sum, out) => sum + out.value, 0)
  
  const inputValue = Math.ceil(feeRate * virtualSize) + outputValue
  const psbt = new Psbt({ network: BTC_JS_NETWORK() })
  psbt.addOutputs(Array.from({ length: mintCount }, () => ({
    address: payment.address!,
    value: inputValue
  })))

  if (serviceFee > dustLimit('p2tr')) {
    psbt.addOutput({
      address: RECEIVE_ADDRESS(),
      value: serviceFee
    })
  }

  const { networkFee } = await calculateTransactionInputsAndFee({
    psbt, utxos, feeRate, paymentAddress, paymentPubkey
  })

  return {
    psbt, internalKey, serviceFee,
    networkFee: networkFee + inputValue * mintCount,
    paddingCost: padding * mintCount
  }
}
