import { payments, Psbt, toXOnly } from "bitcoinjs-lib"
import { MAX_UNCONFIRMED_DESCENDANT_TXNS, MIN_FEE_RATE } from "../../../config/constants.js"
import { RECEIVE_ADDRESS } from "../../../config/env-vars.js"
import { Utxo } from "../getUtxos.js"
import { calculateTransactionInputsAndFee } from "../utils/calculateTransactionInputsAndFee.js"
import { dustLimit } from "../utils/dustLimit.js"
import getAddressType from "../utils/getAddressType.js"
import { randomKey } from "../utils/keys.js"
import { BTC_JS_NETWORK } from "../utils/network.js"
import { getAlkaneMintServiceFee } from "../utils/service-fee.js"
import { createAlkaneMintScript } from "./createAlkaneMintScript.js"
import { getAlkaneMintTransactionSize } from "./getAlkaneMintTransactionSize.js"

interface CreateAlkaneUserTransactionArgs {
  feeRate: number
  paymentAddress: string
  paymentPubkey: string
  receiveAddress: string
  alkaneId: string
  mintCount: number
  utxos: Utxo[]
}

export async function createAlkaneUserTransaction({
  feeRate, alkaneId, receiveAddress, mintCount, utxos, paymentAddress, paymentPubkey
} : CreateAlkaneUserTransactionArgs) {
  feeRate = Math.max(feeRate, MIN_FEE_RATE)
  const internalKey = randomKey()
  const internalPubKey = toXOnly(internalKey.publicKey)
  const internalPayment = payments.p2tr({ pubkey: internalPubKey, network: BTC_JS_NETWORK() })
  
  const addressType = getAddressType(receiveAddress)

  const runescript = createAlkaneMintScript(alkaneId)
  const mintTxSize = getAlkaneMintTransactionSize({ runescript, outputAddressType: 'p2tr' })
  const finalMintTxSize = getAlkaneMintTransactionSize({ runescript, outputAddressType: addressType })
  const feePerMint = BigInt(Math.ceil(feeRate * mintTxSize))
  const feeOfFinalMint = BigInt(Math.ceil(feeRate * finalMintTxSize))
  const txnsPerGroup = MAX_UNCONFIRMED_DESCENDANT_TXNS
  const txnsInLastGroup = (mintCount - 1) % txnsPerGroup

  const outputValue = dustLimit(addressType)
  const serviceFee = getAlkaneMintServiceFee(mintCount)

  const psbt = new Psbt({ network: BTC_JS_NETWORK() })
  const fullGroupCount = Math.floor((mintCount - 1) / txnsPerGroup)
  const mintsInEachOutput = Array.from({ length: fullGroupCount }, () => txnsPerGroup)
  if (txnsInLastGroup > 0) {
    mintsInEachOutput.push(txnsInLastGroup)
  }

  if (mintCount === 1) {
    psbt.addOutput({
      address: receiveAddress,
      value: outputValue
    })
  } else {
    psbt.addOutputs(mintsInEachOutput.map(mints => ({
      script: internalPayment.output!,
      value: outputValue + BigInt(mints - 1) * feePerMint + feeOfFinalMint
    })))
  }

  if (serviceFee > dustLimit('p2tr')) {
    psbt.addOutput({
      address: RECEIVE_ADDRESS(),
      value: serviceFee
    })
  }

  psbt.addOutput({
    script: runescript.output!,
    value: 0n
  })

  const { networkFee } = await calculateTransactionInputsAndFee({
    psbt, utxos, feeRate, paymentAddress, paymentPubkey
  })

  return {
    psbt, internalKey, serviceFee,
    networkFee: networkFee + BigInt(mintCount - 1 - mintsInEachOutput.length) * feePerMint + BigInt(mintsInEachOutput.length) * feeOfFinalMint,
    feePerMint, feeOfFinalMint,
    paddingCost: mintCount === 1 ? outputValue : BigInt(mintsInEachOutput.length) * outputValue,
    mintsInEachOutput
  }
}
