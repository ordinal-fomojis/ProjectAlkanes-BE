import { trace } from "@opentelemetry/api"
import { z } from "zod"
import { withSpan } from "../instrumentation/instrumentation.js"
import { parse } from "./parse.js"

const tracer = trace.getTracer("retryFetch")

export const DEFAULT_RETRY_FETCH_TIMES = 4

export class RequestError extends Error {
  constructor(public status: number, public text: string, public url: string) {
    super(`Request failed with error ${status}: ${text}`)
  }
}

export interface RetryFetchOptions {
  retries?: number
  retryCondition?: (error: unknown, base: () => boolean) => Promise<boolean> | boolean
  delay?: (attempt: number, error: unknown, base: () => number) => Promise<number> | number
}

async function retryResponseFetch(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1], options: RetryFetchOptions = {}) {
  const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : input.toString())
  for (let attempt = 1;; attempt++) {
    try {
      const response = await fetch(input, init)
      if (response.ok) {
        return response
      } else {
        throw new RequestError(response.status, await response.text(), url)
      }
    } catch (error) {
      if (error instanceof DOMException && (error.name === 'AbortError' || error.name === "TimeoutError")) {
        throw error
      }

      const delay = await calculateDelay(options, attempt, error)
      if (delay == null) {
        throw error
      }
      await new Promise(r => setTimeout(r, delay))
    }
  }
}

export const retryBlobFetch = withSpan(tracer, "retryBlobFetch", async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1], options: RetryFetchOptions = {}) => {
  return await retryResponseFetch(input, init, options).then(x => x.blob())
})

export const retryFetch = withSpan(tracer, "retryFetch", async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1], options: RetryFetchOptions = {}) => {  
  return await retryResponseFetch(input, init, options).then(x => x.text())
})

export const retryJsonFetch = withSpan(tracer, "retryJsonFetch", async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1], options: RetryFetchOptions = {}) => {
  return await retryResponseFetch(input, init, options).then(x => x.json())
})

export const retryBufferFetch = withSpan(tracer, "retryBufferFetch", async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1], options: RetryFetchOptions = {}) => {
  return await retryResponseFetch(input, init, options).then(x => x.arrayBuffer())
})

export const retrySchemaFetch = withSpan(tracer, "retrySchemaFetch", async <Output, Input>(schema: z.ZodType<Output, Input>, ...args: Parameters<typeof retryJsonFetch>) => {
  return await retryResponseFetch(...args).then(async response => parse(schema, await response.json()))
})

async function calculateDelay(options: RetryFetchOptions, attempt: number, error: unknown) {
  if (attempt >= (options.retries ?? DEFAULT_RETRY_FETCH_TIMES)) return null
  const shouldRetry = await options.retryCondition?.(error, () => baseCondition(error)) ?? baseCondition(error)
  if (!shouldRetry) return null
  const delay = await options.delay?.(attempt, error, () => baseDelay(attempt)) ?? baseDelay(attempt)
  return jitter(delay)
}

const retry400Codes = [429, 408, 425, 413]
function baseCondition(error: unknown) {
  if (error instanceof RequestError) {
    return error.status >= 500 || retry400Codes.includes(error.status)
  }
  return true
}

function baseDelay(attempt: number) {
  return 100 * Math.pow(2, attempt)
}

function jitter(time: number) {
  return time * (0.9 + Math.random() * 0.2)
}
