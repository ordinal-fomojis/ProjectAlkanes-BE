import { describe, expect, it } from "vitest"
import { leb128encode } from "../../../src/utils/transaction/utils/leb128encode.js"

describe("leb128encode", () => {
  it.each([
    [0, Buffer.from([0])],
    [BigInt(0), Buffer.from([0])],
    [Buffer.from([0]), Buffer.from([0])],
    [20, Buffer.from([20])],
    [624485, Buffer.from([0xE5, 0x8E, 0x26])],
    [BigInt(624485), Buffer.from([0xE5, 0x8E, 0x26])],
    [Buffer.from([0x65, 0x87, 0x09]), Buffer.from([0xE5, 0x8E, 0x26])],
    [Buffer.from([0x65, 0x87, 0x09, 0x00]), Buffer.from([0xE5, 0x8E, 0xA6, 0x00])],
  ])("should encode correctly: case %#", (value, expected) => {
    const result = leb128encode(value)
    expect(result).toEqual(expected)
  })
})
