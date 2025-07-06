import { Payment, payments, Psbt } from "bitcoinjs-lib"
import { toXOnly } from "bitcoinjs-lib/src/psbt/bip371.js"
import { createPayment } from "./createPayment.js"
import { dustLimit } from "./utils/dustLimit.js"
import { AddressType } from "./utils/getAddressType.js"
import './utils/init-ecc'
import { BTC_JS_NETWORK } from "./utils/network.js"
import { randomKey } from "./utils/randomKey.js"

interface GetMintTransactionSizeArgs {
  runescript: Payment
  outputAddressType: AddressType
}

export function getMintTransactionSize({ runescript, outputAddressType } : GetMintTransactionSizeArgs) {
  const outputValue = dustLimit(outputAddressType)
  const outputKey = randomKey()
  const inputKey = randomKey()

  const outputPayment = createPayment({
    addressType: outputAddressType,
    publicKey: outputKey.publicKey
  })

  const inputPubKey = toXOnly(inputKey.publicKey)
  const inputPayment = payments.p2tr({ pubkey: inputPubKey, network: BTC_JS_NETWORK })

  const psbt = new Psbt({ network: BTC_JS_NETWORK })

  psbt.addInput({
    hash: "0000000000000000000000000000000000000000000000000000000000000000",
    index: 0,
    sequence: 0xFFFFFFFD, 
    tapInternalKey: toXOnly(inputKey.publicKey), 
    witnessUtxo: { value: outputValue, script: inputPayment.output! }
  })

  psbt.addOutputs([
    {
      script: outputPayment.output!,
      value: outputValue
    },
    {
      script: runescript.output!,
      value: 0
    }
  ])
  
  psbt.signAllInputs(inputKey)
  psbt.finalizeAllInputs()
  return psbt.extractTransaction().virtualSize()
}
