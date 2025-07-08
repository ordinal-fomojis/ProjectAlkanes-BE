import { opcodes, payments, script } from "bitcoinjs-lib"
import { leb128encode } from "../utils/leb128encode.js"

const PROTORUNE_TAG = 16383
const CALLDATA_TAG = 81
const MINT_OP_CODE = 77

export function createScriptForAlkaneMint(alkaneId: string) {
  const runestone = createRunestoneForAlkaneMint(alkaneId)
  return payments.embed({
    output: script.compile([opcodes.OP_RETURN!, opcodes.OP_13!, runestone])
  }, { validate: false })
}

function createRunestoneForAlkaneMint(alkaneId: string) {
  const idParts = alkaneId.split(':').map(part => parseInt(part))
  if (idParts.length !== 2 || idParts.some(isNaN)) {
    throw new Error(`Invalid alkaneId format: ${alkaneId}`)
  }
  const protostoneMessage = [...idParts, MINT_OP_CODE]
  return encodeRunestone(protostoneMessage)
}

function encodeRunestone(protostoneMessage: number[]) {
  const protostone = encodeProtostoneMessage(protostoneMessage)
  return Buffer.concat(encodeTag(PROTORUNE_TAG, protostone))
}

function encodeProtostoneMessage(protostoneMessage: number[]) {
  const protocol = leb128encode(1)
  const size = leb128encode(protostoneMessage.length)
  const tags = encodeTag(CALLDATA_TAG, Buffer.concat(protostoneMessage.map(leb128encode)))
  return Buffer.concat([protocol, size, ...tags])
}

function encodeTag(tag: number, value: Buffer) {
  const chunks = []
  for (let i = 0; i < value.length; i += 15) {
    chunks.push(value.subarray(i, i + 15))
  }
  return chunks.map(chunk => [leb128encode(tag), leb128encode(chunk)]).flat()
}
