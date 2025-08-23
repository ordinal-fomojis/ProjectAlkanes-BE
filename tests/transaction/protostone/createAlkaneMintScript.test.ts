import { describe, expect, it } from "vitest"
import { createAlkaneMintScript } from "../../../src/utils/transaction/alkanes/createAlkaneMintScript.js"

describe("createAlkaneMintScript", () => {
  it.each([
    ['2:0', "6a5d0eff7f818cec82d08bc0a88281d215"],
    ['2:194', "6a5d0fff7f818cec82d08bc0a882899ec44e"],
  ])("should create correct runstone: case %#", (value, expected) => {
    const result = createAlkaneMintScript(value)
    expect(result.output?.toString('hex')).toEqual(expected)
  })

  it("should throw error for invalid alkaneId format", () => {
    expect(() => createAlkaneMintScript('invalid:format')).toThrow("Invalid alkaneId format: invalid:format")
  })
})
