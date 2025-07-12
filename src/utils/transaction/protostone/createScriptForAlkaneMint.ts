import { opcodes, payments, script } from "bitcoinjs-lib"
import { leb128encode } from "../utils/leb128encode.js"

const RuneTag = {
  Protocol: 16383
}

const ProtoTag = {
  Message: 81,
  Pointer: 91,
  Refund: 93,
}

const AlkaneOpCode = {
  Mint: 77
}

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
  const protostoneMessage = [...idParts, AlkaneOpCode.Mint]
  return encodeRunestone(protostoneMessage)
}

function encodeRunestone(protostoneMessage: number[]) {
  const protostone = encodeProtostoneMessage(protostoneMessage)
  return Buffer.concat(encodeTag(RuneTag.Protocol, protostone))
}

function encodeProtostoneMessage(protostoneMessage: number[]) {
  const protocol = leb128encode(1)
  const zeroBuffer = Buffer.alloc(1, 0)
  const tags = [
    encodeTag(ProtoTag.Pointer, zeroBuffer),
    encodeTag(ProtoTag.Refund, zeroBuffer),
    encodeTag(ProtoTag.Message, Buffer.concat(protostoneMessage.map(leb128encode))),
  ].flat()
  const size = leb128encode(tags.length)
  return Buffer.concat([protocol, size, ...tags])
}

function encodeTag(tag: number, value: Buffer) {
  const chunks = []
  for (let i = 0; i < value.length; i += 15) {
    chunks.push(value.subarray(i, i + 15))
  }
  return chunks.map(chunk => [leb128encode(tag), leb128encode(chunk)]).flat()
}
