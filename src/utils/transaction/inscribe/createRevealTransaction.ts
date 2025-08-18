import { Payment, Psbt, Signer } from "bitcoinjs-lib"
import { toXOnly } from "bitcoinjs-lib/src/psbt/bip371.js"
import varuint from "varuint-bitcoin"
import { dustLimit } from "../utils/dustLimit.js"
import getAddressType from "../utils/getAddressType.js"
import { BTC_JS_NETWORK } from "../utils/network.js"
import { InscriptionFile } from "./createRevealPayment.js"

export interface BaseInput {
  hash: string
  index: number
  value: number
}

export type InscriptionOutput = InscriptionFile & { destination: string }

export function createRevealTransaction(
  payment: Payment, files: InscriptionOutput[], key: Signer, baseInput: BaseInput
) {
  const input = {
    hash: baseInput.hash,
    index: baseInput.index,
    sequence: 0xFFFFFFFD,
    tapInternalKey: toXOnly(key.publicKey),
    witnessUtxo: { value: baseInput.value, script: payment.output! },
    tapMerkleRoot: payment.hash,
    tapLeafScript: [
      {
        leafVersion: payment.redeemVersion!,
        script: payment.redeem!.output!,
        controlBlock: payment.witness![payment!.witness!.length - 1]!
      }
    ]
  }
  
  const outputs = files.map(({ destination, padding }) => ({
    address: destination,
    value: padding ?? dustLimit(getAddressType(destination))
  }))
  
  const psbt = new Psbt({ network: BTC_JS_NETWORK }).addInput(input)
  
  psbt.addOutputs(outputs)
  psbt.signAllInputs(key)
  psbt.finalizeInput(0, (_: number, input: PsbtInput) => customFinalizer(input))
  return psbt.extractTransaction()
}

type PsbtInput = Parameters<NonNullable<Parameters<Psbt['finalizeInput']>[1]>>[1]
function customFinalizer(input: PsbtInput) {
  const scriptSolution = [
    input.tapScriptSig![0]!.signature
  ]
  const witness = scriptSolution
      .concat(input.tapLeafScript![0]!.script)
      .concat(input.tapLeafScript![0]!.controlBlock)
  return {
    finalScriptWitness: witnessStackToScriptWitness(witness)
  }
}

function witnessStackToScriptWitness(witness: Uint8Array[]) {
  let buffer = Buffer.allocUnsafe(0)

  function writeSlice(slice: Uint8Array) {
      buffer = Buffer.concat([buffer, slice])
  }

  function writeVarInt(i: number) {
      const currentLen = buffer.length;
      const varintLen = varuint.encodingLength(i)

      buffer = Buffer.concat([buffer, Buffer.allocUnsafe(varintLen)])
      varuint.encode(i, buffer, currentLen)
  }

  function writeVarSlice(slice: Uint8Array) {
      writeVarInt(slice.length)
      writeSlice(slice)
  }

  function writeVector(vector: Uint8Array[]) {
      writeVarInt(vector.length)
      vector.forEach(writeVarSlice)
  }

  writeVector(witness)

  return buffer
}
