import { Payment, Psbt, toXOnly, Transaction } from "bitcoinjs-lib"
import { getRawTransactions } from "../rpc/getRawTransactions.js"
import { AddressType } from "./utils/getAddressType.js"

interface CreateInputArgs {
  addressType: AddressType
  txid: string
  vout: number
  publicKey: Buffer
  value: bigint
  payment: Payment
  dummyInputTx?: Transaction
}

export async function createInput({
  addressType, txid, vout, publicKey, value, payment, dummyInputTx
}: CreateInputArgs): Promise<Parameters<Psbt['addInput']>[0]> {  
  if (addressType === 'p2tr') {
    return {
      hash: txid,
      index: vout,
      sequence: 0xFFFFFFFD,
      tapInternalKey: toXOnly(publicKey), 
      witnessUtxo: { value, script: payment.output! }
    }
  } else if (addressType === 'p2sh-p2wpkh') {
    return {
      hash: txid,
      index: vout,
      witnessUtxo: {
        script: payment.output!,
        value: value
      },
      redeemScript: payment.redeem?.output
    }
  } else if (addressType === 'p2wpkh') {
    return {
      hash: txid,
      index: vout,
      witnessUtxo: {
        script: payment.output!,
        value: value
      }
    }
  } else {
    const txHex = dummyInputTx?.toHex() ?? (await getTxHex(txid))
    return {
      hash: dummyInputTx?.getId() ?? txid,
      index: dummyInputTx == null ? vout : 0,
      nonWitnessUtxo: Buffer.from(txHex, 'hex')
    }
  } 
}

const getTxHex = async (txid: string) => {
  const [response] = await getRawTransactions([txid])
  if (response == null || !response.success) {
    throw (response?.error ?? new Error(`Failed to fetch transaction ${txid}`))
  }
  return response.response
}
