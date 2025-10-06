import { Signer, opcodes, payments, script, toXOnly } from "bitcoinjs-lib"
import { encode } from 'cbor2'
import { brotliCompressSync } from "zlib"
import { UserError } from "../../errors.js"
import { MimeType } from "../../mime-type.js"
import '../utils/init-ecc.js'
import { BTC_JS_NETWORK } from "../utils/network.js"

export type RevealDetails = Awaited<ReturnType<typeof createRevealPayment>>
export interface InscriptionFile {
  content?: {
    data: Buffer
    type: MimeType
  }
  padding: bigint
  onchainMetadata?: unknown
  metaprotocol?: string
  compress?: boolean
  delegate?: string
}

const InscriptionField = {
  FILE_TYPE: 0x01,
  POINTER: 0x02,
  METADATA: 0x05,
  METAPROTOCOL: 0x7,
  CONTENT_ENCODING: 0x9,
  DELEGATE: 0x0B
} as const
type InscriptionField = (typeof InscriptionField)[keyof typeof InscriptionField]

const BTC_SCRIPT_CHUNK_SIZE = 520

export function createRevealPayment(key: Signer, files: InscriptionFile[]) {
  const publicKey = toXOnly(key.publicKey)

  const revealScript = createRevealScript(publicKey, files)
  const scriptTree = {
    output: revealScript
  }
  const redeem = {
    output: revealScript
  }

  return payments.p2tr({
    internalPubkey: publicKey,
    scriptTree,
    redeem,
    network: BTC_JS_NETWORK()
  })
}

function createRevealScript(publicKey: Uint8Array, files: InscriptionFile[]) {
  const commands = [publicKey, opcodes.OP_CHECKSIG!]
  let pointer = 0n
  for (const file of files) {
    const envelope: (number | Buffer)[] = []

    if (pointer > 0) {
      envelope.push(...inscriptionField(InscriptionField.POINTER, littleEndianBuffer(pointer)))
    }
    pointer += file.padding
    
    if (file.onchainMetadata !== undefined) {
      const encoded = encode(file.onchainMetadata)
      envelope.push(...inscriptionField(InscriptionField.METADATA, Buffer.from(encoded)))
    }
    if (file.metaprotocol != null) {
      envelope.push(...inscriptionField(InscriptionField.METAPROTOCOL, file.metaprotocol))
    }
    if (file.compress === true) {
      envelope.push(...inscriptionField(InscriptionField.CONTENT_ENCODING, 'br'))
    }
    if (file.delegate != null) {
      envelope.push(...inscriptionField(InscriptionField.DELEGATE, encodeId(file.delegate)))
    }

    if (file.content != null) {
      envelope.push(...inscriptionField(InscriptionField.FILE_TYPE, file.content.type))
      const data = file.compress === true ? brotliCompressSync(file.content.data) : file.content.data
      envelope.push(opcodes.OP_0!, ...dataToPushes(data))
    }

    commands.push(
      opcodes.OP_FALSE!,
      opcodes.OP_IF!,
      Buffer.from('ord', 'utf-8'),
      ...envelope,
      opcodes.OP_ENDIF!
    )
  }

  return script.compile(commands)
}

function inscriptionField(field: InscriptionField, content: string | Buffer) {
  if (typeof content === 'string') {
    content = Buffer.from(content, 'utf-8')
  }
  return dataToPushes(content).map(push => [0x01, field, ...fromBuffer(push)]).flat()
}

function dataToPushes(data: Buffer) {
  const chunks: Buffer[] = []
  for (let i = 0; i < data.length / BTC_SCRIPT_CHUNK_SIZE; i++) {
    chunks.push(data.subarray(i * BTC_SCRIPT_CHUNK_SIZE, (i + 1) * BTC_SCRIPT_CHUNK_SIZE))
  }
  return chunks
}

// Creates a data push from a buffer, ensuring OP_NUM op codes are not used
function fromBuffer(buffer: Buffer) {
  const first = buffer[0]
  if (first == null) {
    return []
  }
  if (buffer.length === 1) {
    return [0x1, first]
  }
  return [buffer]
}

// Converts integer to little endian buffer with trailing zeros omitted
function littleEndianBuffer(n: number | bigint) {
  n = typeof n === "number" ? BigInt(n) : n
  const bytes: number[] = []
  while (n > 0n) {
    bytes.push(Number(n & 0xffn))

    n >>= 8n
  }
  return Buffer.from(bytes)
}

function encodeId(id: string) {
  const match = id.match(/^([\da-fA-F]{64})i(\d+)$/)
  if (match == null || match[1] == null || match[2] == null) {
    throw new UserError(`Invalid inscription ID: ${id}`)
  }
  const index = littleEndianBuffer(parseInt(match[2]))
  const txidBuffer = Buffer.from(match[1], 'hex')
  txidBuffer.reverse()
  return Buffer.concat([txidBuffer, index])
}
