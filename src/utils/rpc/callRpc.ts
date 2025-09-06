import { z } from "zod"
import { BITCOIN_NETWORK, SANDSHREW_API_KEY } from "../../config/env-vars.js"
import { retrySchemaFetch } from "../retryFetch.js"

const BitcoinRpcUrls = {
  'mainnet': `https://mainnet.sandshrew.io/v1`,
  'signet': `https://signet.sandshrew.io/v1`,
  'testnet': `https://testnet.sandshrew.io/v1`
}
export const BITCOIN_RPC_URL = () => `${BitcoinRpcUrls[BITCOIN_NETWORK()]}/${SANDSHREW_API_KEY()}`

export async function callRpc<T extends z.ZodTypeAny>(schema: T, method: string, params: unknown[] = []) {
  const rpcSchema = z.object({
    error: z.any().nullish().optional(),
    result: schema.nullish().optional()
  })
  const response = await retrySchemaFetch(rpcSchema, BITCOIN_RPC_URL(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: "2.0", 
      id: 1, 
      method: method,
      params
    })
  })
  if (response.result != null) {
    return response.result
  } else {
    throw new Error(`Bitcoin RPC error: ${JSON.stringify(response.error ?? 'Unknown error')}`)
  }
}
