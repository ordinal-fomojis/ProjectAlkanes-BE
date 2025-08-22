import { bigDecimal } from "js-big-decimal"
import { MimeType } from "../../mime-type.js"
import { Utxo } from "../getUtxos.js"
import { createInscriptionUserTransaction } from "../inscribe/createInscriptionUserTransaction.js"
import { InscriptionOutput } from "../inscribe/createRevealTransaction.js"
import { dustLimit } from "../utils/dustLimit.js"
import getAddressType from "../utils/getAddressType.js"
import { getBrcMintServiceFee } from "../utils/service-fee.js"
import { getBrcMintInscriptionContent } from "./getBrcMintInscriptionContent.js"

interface CreateBrcUserTransactionArgs {
  feeRate: number
  paymentAddress: string
  paymentPubkey: string
  receiveAddress: string
  mintAmount: bigDecimal
  mintCount: number
  ticker: string
  utxos: Utxo[]
}

export async function createBrcUserTransaction({
  feeRate, paymentAddress, paymentPubkey, receiveAddress, mintAmount, mintCount, ticker, utxos
}: CreateBrcUserTransactionArgs) {
  const inscriptionContent = getBrcMintInscriptionContent(ticker, mintAmount)

  const serviceFee = getBrcMintServiceFee(mintCount)
  const padding = dustLimit(getAddressType(receiveAddress))
  const files = Array.from({ length: mintCount }, () => ({
    destination: receiveAddress, padding,
    contents: { data: inscriptionContent, type: MimeType.json }
  } satisfies InscriptionOutput))

  return await createInscriptionUserTransaction({
    feeRate, utxos, paymentAddress, paymentPubkey, files, serviceFee
  })
}
