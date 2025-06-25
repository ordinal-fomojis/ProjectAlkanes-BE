import z from "zod"
import { ORDISCAN_API_KEY } from "../../config/constants.js"
import { retrySchemaFetch } from "../retryFetch.js"

export async function ordiscanFetch<T extends z.ZodTypeAny>(schema: T, path: string, params: Record<string, string> = {}) {
  const responseSchema = z.object({
    data: schema.nullish().optional(),
    error: z.any().nullish().optional()
  })
  const urlParams = new URLSearchParams(params).toString()
  const response = await retrySchemaFetch(responseSchema, `https://api.ordiscan.com/v1/${path}?${urlParams}`, {
    headers: {
      'Authorization': `Bearer ${ORDISCAN_API_KEY}`,
    }
  })
  if (response.data != null) {
    return response.data
  } else {
    throw new Error(`Ordiscan error: ${JSON.stringify(response.error) ?? 'Unknown error'}`)
  }
}
