import { Payment, payments, Psbt, Signer } from "bitcoinjs-lib"
import { toXOnly } from "bitcoinjs-lib/src/psbt/bip371.js"
import { Utxo } from "../getUtxos.js"
import { BTC_JS_NETWORK } from "../utils/network.js"
import './utils/init-ecc.js'

interface GetMintTransactionSizeArgs {
  outputAddress: string
  runescript: Payment
  fee?: number
  key: Signer
  utxo: Utxo
  pubkey?: Buffer
  payment?: Payment
}

export function createAlkaneMintTransaction({
  runescript, outputAddress, fee = 0, key, pubkey, payment, utxo
} : GetMintTransactionSizeArgs) {
  pubkey ??= toXOnly(key.publicKey)
  payment ??= payments.p2tr({ pubkey: pubkey, network: BTC_JS_NETWORK })

  const psbt = new Psbt({ network: BTC_JS_NETWORK })

  psbt.addInput({
    hash: utxo.txid,
    index: utxo.vout,
    sequence: 0xFFFFFFFD, 
    tapInternalKey: pubkey, 
    witnessUtxo: { value: utxo.value, script: payment.output! }
  })

  psbt.addOutputs([
    {
      address: outputAddress,
      value: utxo.value - fee
    },
    {
      script: runescript.output!,
      value: 0
    }
  ])
  
  psbt.signAllInputs(key)
  psbt.finalizeAllInputs()
  return psbt.extractTransaction()
}
