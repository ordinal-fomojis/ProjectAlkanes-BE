import z from "zod"
import { callRpc } from "./callRpc.js"

export async function callMultiRpc<T extends z.ZodTypeAny>(schema: T, params: [string, unknown[]][]) {
  const rpcSchema = z.array(z.object({
    result: schema.nullish().optional(),
    error: z.any().nullish().optional()
  }))
  
  const response = await callRpc(rpcSchema, 'sandshrew_multicall', params)
  const responseList = response.map((response, index) => {
    if (response.result == null) {
      const method = params[index]?.[0]
      const param = JSON.stringify(params[index]?.[1])
      const errorMessage = JSON.stringify(response.error) || 'Unknown error'
      const error = new Error(`Bitcoin RPC error for ${method} with params ${param}: ${errorMessage}`)
      return { success: false, error } as const
    }
    return { success: true, response: response.result } as const
  })
  
  return responseList
}
