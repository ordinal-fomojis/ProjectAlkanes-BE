import { Psbt } from "bitcoinjs-lib"
import { MIN_FEE_RATE } from "../../../config/constants.js"
import { RECEIVE_ADDRESS } from "../../../config/env-vars.js"
import { Utxo } from "../getUtxos.js"
import { calculateTransactionInputsAndFee } from "../utils/calculateTransactionInputsAndFee.js"
import { dustLimit } from "../utils/dustLimit.js"
import { randomKey } from "../utils/keys.js"
import { BTC_JS_NETWORK } from "../utils/network.js"
import { createRevealBatches } from "./createRevealBatches.js"
import { InscriptionOutput } from "./createRevealTransaction.js"

interface CreateInscriptionUserTransactionArgs {
  feeRate: number
  paymentAddress: string
  paymentPubkey: string
  files: InscriptionOutput[]
  utxos: Utxo[]
  serviceFee: number
}

export async function createInscriptionUserTransaction({
  feeRate, utxos, paymentAddress, paymentPubkey, files, serviceFee
} : CreateInscriptionUserTransactionArgs) {
  feeRate = Math.max(feeRate, MIN_FEE_RATE)
  const internalKey = randomKey()
  
  const batches = createRevealBatches(files, internalKey)

  const psbt = new Psbt({ network: BTC_JS_NETWORK() })
  for (const batch of batches) {
    const inputValue = Math.ceil(feeRate * batch.virtualSize) + batch.outputValue
    psbt.addOutput({
      address: batch.payment.address!,
      value: inputValue
    })
  }

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
    networkFee: networkFee + batches.reduce((sum, batch) => sum + Math.ceil(feeRate * batch.virtualSize), 0),
    paddingCost: batches.reduce((sum, batch) => sum + batch.outputValue, 0)
  }
}
