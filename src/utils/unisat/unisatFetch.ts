import { z } from "zod"
import { BITCOIN_NETWORK, UNISAT_API_KEY } from "../../config/constants.js"
import { retrySchemaFetch } from "../retryFetch.js"

export async function unisatFetch<Output, Input>(schema: z.ZodType<Output, Input>, path: string) {
  const baseUrl = `https://open-api${BITCOIN_NETWORK === 'mainnet' ? '' : '-testnet'}.unisat.io/v1/indexer`
  
  const unisatSchema = z.object({
    code: z.union([z.literal(0), z.literal(-1)]),
    msg: z.string().default('Unisat did not return a message'),
    data: schema.nullable()
  })
  const { code, msg, data } = await retrySchemaFetch(unisatSchema, `${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${UNISAT_API_KEY}` }
  })

  if (code === -1 || data == null) {
    throw new Error(`Unisat request to ${path} failed with message: ${msg}`)
  }
  return data
}
