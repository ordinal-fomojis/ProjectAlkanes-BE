import { describe, expect, it } from "vitest"
import { getMintTransactionSize } from "../../src/utils/transaction/getMintTransactionSize.js"
import { createScriptForAlkaneMint } from "../../src/utils/transaction/protostone/createScriptForAlkaneMint.js"

describe("getMintTransactionSize", () => {
  it.each([
    { outputAddressType: 'p2wpkh', expectedSize: 121 },
    { outputAddressType: 'p2sh-p2wpkh', expectedSize: 122 },
    { outputAddressType: 'p2tr', expectedSize: 133 },
    { outputAddressType: 'p2pkh', expectedSize: 124 },
  ] as const)("should return the correct size for $outputAddressType", ({ outputAddressType, expectedSize }) => {
    const runescript = createScriptForAlkaneMint('2:0')
    expect(getMintTransactionSize({ runescript, outputAddressType })).toEqual(expectedSize)
  })
})
