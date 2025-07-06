import { describe, expect, it } from "vitest"
import { createScriptForAlkaneMint } from "../../../src/utils/transaction/protostone/createRunestoneForAlkaneMint.js"

describe("createScriptForAlkaneMint", () => {
  it.each([
    ['2:0', "6a5d0aff7f8186c4928890ad01"],
    ['2:194', "6a5d0bff7f8186c492c8f0a1f404"],
  ])("should create correct runstone: case %#", (value, expected) => {
    const result = createScriptForAlkaneMint(value)
    expect(result.output?.toString('hex')).toEqual(expected)
  })

  it("should throw error for invalid alkaneId format", () => {
    expect(() => createScriptForAlkaneMint('invalid:format')).toThrow("Invalid alkaneId format: invalid:format")
  })
})
