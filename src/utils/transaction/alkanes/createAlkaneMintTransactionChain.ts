import { Payment, payments, Signer, toXOnly, Transaction } from "bitcoinjs-lib"
import { Utxo } from "../getUtxos.js"
import { BTC_JS_NETWORK } from "../utils/network.js"
import { createAlkaneMintTransaction } from "./createAlkaneMintTransaction.js"

interface CreateAlkaneMintTransactionChainArgs {
  utxo: Utxo
  feePerMint: bigint
  feeOfFinalMint: bigint
  runescript: Payment
  mintCount: number
  key: Signer
  outputAddress: string
}

export async function createAlkaneMintTransactionChain({
  utxo, feePerMint, runescript, mintCount, key, outputAddress, feeOfFinalMint
} : CreateAlkaneMintTransactionChainArgs) {
  const pubkey = toXOnly(key.publicKey)
  const payment = payments.p2tr({ pubkey: pubkey, network: BTC_JS_NETWORK() })
  
  const txns: Transaction[] = []
  for (let i = 0; i < mintCount; i++) {
    const fee = i === mintCount - 1 ? feeOfFinalMint : feePerMint
    const txn = createAlkaneMintTransaction({
      runescript, utxo, key, fee,
      outputAddress: i === mintCount - 1 ? outputAddress : payment.address!,
    })
    txns.push(txn)
    utxo = {
      txid: txn.getId(),
      vout: 0,
      value: utxo.value - fee
    }
  }

  return txns
}
