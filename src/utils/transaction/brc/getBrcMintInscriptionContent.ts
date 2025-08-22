import { bigDecimal } from "js-big-decimal"

interface BrcMintJson {
  p: "brc-20"
  op: "mint"
  tick: string
  amt: string
}

export function getBrcMintInscriptionContent(ticker: string, amount: bigDecimal) {
  const mint: BrcMintJson = {
    p: "brc-20",
    op: "mint",
    tick: ticker,
    amt: amount.getValue()
  }

  return Buffer.from(JSON.stringify(mint))
}
