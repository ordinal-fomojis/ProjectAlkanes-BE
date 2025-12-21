import { trace } from "@opentelemetry/api"
import { z } from "zod"
import { BITCOIN_NETWORK, UNISAT_API_KEY } from "../../config/env-vars.js"
import { withSpan } from "../../instrumentation/instrumentation.js"
import { RequestError, RetryFetchOptions, retrySchemaFetch } from "../retryFetch.js"

function isRateLimitError(error: unknown) {
  if (!(error instanceof RequestError)) return false
  if (error.status === 429) return true
  if (error.status !== 403) return false
  try {
    const err = JSON.parse(error.text) as { code?: number }
    return err.code === -2006
  } catch {
    return false
  }
}

const RetryOptions: RetryFetchOptions = {
  delay: (_, error, base) => isRateLimitError(error) ? Math.max(10 * base(), 4000) : base(),
  retryCondition: (error, base) => isRateLimitError(error) ? true : base()
}

const tracer = trace.getTracer("unisatFetch")

export const unisatFetch = withSpan(tracer, "unisatFetch", async <Output, Input>(schema: z.ZodType<Output, Input>, path: string) => {
  const baseUrl = `https://open-api${BITCOIN_NETWORK() === 'mainnet' ? '' : '-testnet'}.unisat.io/v1/indexer`
  
  const unisatSchema = z.object({
    code: z.union([z.literal(0), z.literal(-1)]),
    msg: z.string().default('Unisat did not return a message'),
    data: schema.nullable()
  })
  const { code, msg, data } = await retrySchemaFetch(unisatSchema, `${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${UNISAT_API_KEY()}` }
  }, RetryOptions)

  if (code === -1 || data == null) {
    throw new Error(`Unisat request to ${path} failed with message: ${msg}`)
  }
  return data
})

export const unisatPagedFetch = withSpan(tracer, "unisatPagedFetch", async <Output, Input>(schema: z.ZodType<Output, Input>, path: string) => {
  if (!path.endsWith('?')) {
    if (path.includes('?') && !path.endsWith('&')) {
      path += '&'
    } else if (!path.includes('?')) {
      path += '?'
    }
  }

  const result: Output[] = []
  const { total, detail } = await getPage(schema, path, 0)
  result.push(...detail)
  let page = 1
  while (result.length < total) {
    const { detail: nextDetail } = await getPage(schema, path, page)
    result.push(...nextDetail)
    page++
  }
  return result
})

const PAGE_SIZE = 500
async function getPage<Output, Input>(schema: z.ZodType<Output, Input>, path: string, page: number) {
  const UnisatPagedSchema = z.object({
    total: z.number(),
    detail: z.array(schema)
  })
  const fullPath = `${path}start=${page * PAGE_SIZE}&limit=${PAGE_SIZE}`
  return await unisatFetch(UnisatPagedSchema, fullPath)
}
