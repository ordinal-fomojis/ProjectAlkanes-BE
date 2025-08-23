import { describe, expect, it } from "vitest"
import { MimeType } from "../../../../src/utils/mime-type.js"
import { getBrcMintInscriptionContent } from "../../../../src/utils/transaction/brc/getBrcMintInscriptionContent.js"

describe('getBrcMintInscriptionContent', () => {
  it.each([
    ['ordi', '1000', 0, '{"p":"brc-20","op":"mint","tick":"ordi","amt":"1000"}'],
    ['ordi', '1000', 2, '{"p":"brc-20","op":"mint","tick":"ordi","amt":"1000"}'],
    ['ordi', '1000', 8, '{"p":"brc-20","op":"mint","tick":"ordi","amt":"1000"}'],
    ['pizza', '500', 18, '{"p":"brc-20","op":"mint","tick":"pizza","amt":"500"}'],
    ['🤬', '500', 4, '{"p":"brc-20","op":"mint","tick":"🤬","amt":"500"}'],
    ['ordi', '0.0001', 8, '{"p":"brc-20","op":"mint","tick":"ordi","amt":"0.0001"}'],
    ['ordi', '0.00000001', 8, '{"p":"brc-20","op":"mint","tick":"ordi","amt":"0.00000001"}'],
    ['ordi', '123.123123123123123123', 18, '{"p":"brc-20","op":"mint","tick":"ordi","amt":"123.123123123123123123"}'],
    ['ordi', '123.123123123123123123', 10, '{"p":"brc-20","op":"mint","tick":"ordi","amt":"123.1231231231"}'],
    ['ordi', '123.123123123123123123', 0, '{"p":"brc-20","op":"mint","tick":"ordi","amt":"123"}'],
  ])('should return correct inscription content for BRC-20 mint, case %$', (ticker, amount, decimal, expected) => {
    const { data, type } = getBrcMintInscriptionContent(ticker, decimal, amount)
    expect(data.toString('utf-8')).toBe(expected)
    expect(type).toBe(MimeType.json)
  })
})
