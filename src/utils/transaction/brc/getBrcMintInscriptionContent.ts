import { bigDecimal } from "js-big-decimal"
import { BrcToken } from "../../../services/BrcTokenService.js"
import { MimeType } from "../../mime-type.js"

interface BrcMintJson {
  p: "brc-20"
  op: "mint"
  tick: string
  amt: string
}

export function getBrcMintInscriptionContent(token: Pick<BrcToken, 'ticker' | 'decimal' | 'limit'>, amountStr: string | null) {
  const mintAmount = new bigDecimal(amountStr ?? token.limit).round(token.decimal).stripTrailingZero()
  const mint: BrcMintJson = {
    p: "brc-20",
    op: "mint",
    tick: token.ticker,
    amt: mintAmount.getValue()
  }
  return {
    mintAmount,
    content: { data: Buffer.from(JSON.stringify(mint)), type: MimeType.json }
  }
}
