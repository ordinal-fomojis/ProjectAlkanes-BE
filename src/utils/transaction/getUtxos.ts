import z from "zod"
import { MOCK_BTC } from "../../config/constants.js"
import { unisatFetch } from "../unisat/unisatFetch.js"
import { randomTransactionId } from "./utils/randomTransactionId.js"

export type Utxo = Awaited<ReturnType<typeof getUtxos>>[number]

const UnisatUtxoSchema = z.object({
  utxo: z.array(z.object({
    txid: z.string(),
    vout: z.number(),
    satoshi: z.number()
  }))
})

export async function getUtxos(address: string) {  
  if (MOCK_BTC) {
    return [{
      value: 10 * 100000000,
      txid: randomTransactionId(),
      vout: 0
    }]
  }
  
  const { utxo } = await unisatFetch(UnisatUtxoSchema, `/address/${address}/available-utxo-data`)
  utxo.sort((a, b) => a.satoshi - b.satoshi)
  return utxo.map(utxo => ({
    value: utxo.satoshi,
    txid: utxo.txid,
    vout: utxo.vout,
  }))
}
