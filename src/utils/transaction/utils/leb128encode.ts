export function leb128encode(value: number | bigint | Buffer) {
  const buffer = typeof value === 'bigint'
    ? bigintToBuffer(value)
    : typeof value === 'number'
      ? numberToBuffer(value)
      : value
  return leb128encodeBuffer(buffer)
}

function bigintToBuffer(value: bigint) {
  const buffer: number[] = []
  do {
    buffer.push(Number(value & BigInt(0xff)))
    value >>= BigInt(8)
  } while (value > BigInt(0))
  return Buffer.from(buffer)
}

function numberToBuffer(value: number) {
  const buffer: number[] = []
  do {
    buffer.push(value & 0xff)
    value >>= 8
  } while (value > 0)
  return Buffer.from(buffer)
}

function leb128encodeBuffer(value: Buffer) {
  const encoded: number[] = []
  let index = 0
  let byte = getByteAtIndex(value, index)
  while (byte != null) {
    encoded.push(byte | 0x80)
    index++
    byte = getByteAtIndex(value, index)
  }
  const lastByte = encoded.pop()
  encoded.push((lastByte ?? 0) & 0x7f)
  return Buffer.from(encoded)
}

function getByteAtIndex(buffer: Buffer, index: number) {
  const startBit = index * 7
  const lowByteIndex = Math.floor(startBit / 8)
  const lowByteOffset = startBit % 8
  const lowByte = buffer[lowByteIndex]
  const highByte = buffer[lowByteIndex + 1]
  if (lowByte == null) return null

  const processReturn = (value: number) => {
    if (value === 0 && highByte == null) {
      // If there is no high byte, then when decoding, these bits will default to 0 anyway,
      // so this byte is not needed if it is 0
      return null
    }
    return value & 0x7f
  }

  if (lowByteOffset <= 1) {
    return processReturn(lowByte >> lowByteOffset)
  }

  const highByteBits = lowByteOffset - 1
  const shiftedHighByte = (highByte ?? 0) & ((1 << highByteBits) - 1)
  return processReturn((lowByte >> lowByteOffset) | (shiftedHighByte << (8 - lowByteOffset)))
}
