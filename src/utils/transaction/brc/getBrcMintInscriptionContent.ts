import { bigDecimal } from "js-big-decimal"
import { MimeType } from "../../mime-type.js"

interface BrcMintJson {
  p: "brc-20"
  op: "mint"
  tick: string
  amt: string
}

export function getBrcMintInscriptionContent(ticker: string, decimal: number, amountStr: string) {
  const amount = new bigDecimal(amountStr).round(decimal).stripTrailingZero()
  const mint: BrcMintJson = {
    p: "brc-20",
    op: "mint",
    tick: ticker,
    amt: amount.getValue()
  }
  return { data: Buffer.from(JSON.stringify(mint)), type: MimeType.json }
}
