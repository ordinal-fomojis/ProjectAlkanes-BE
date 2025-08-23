import { describe, expect, it } from "vitest"
import { createAlkaneMintScript } from "../../src/utils/transaction/alkanes/createAlkaneMintScript.js"
import { getAlkaneMintTransactionSize } from "../../src/utils/transaction/alkanes/getAlkaneMintTransactionSize.js"

describe("getAlkaneMintTransactionSize", () => {
  it.each([
    { outputAddressType: 'p2wpkh', expectedSize: 125 },
    { outputAddressType: 'p2sh-p2wpkh', expectedSize: 126 },
    { outputAddressType: 'p2tr', expectedSize: 137 },
    { outputAddressType: 'p2pkh', expectedSize: 128 },
  ] as const)("should return the correct size for $outputAddressType", ({ outputAddressType, expectedSize }) => {
    const runescript = createAlkaneMintScript('2:0')
    expect(getAlkaneMintTransactionSize({ runescript, outputAddressType })).toEqual(expectedSize)
  })
})
