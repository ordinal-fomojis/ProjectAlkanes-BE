import { AttributeValue, Span, SpanStatusCode, trace, Tracer } from "@opentelemetry/api"
import { ObjectId } from "mongodb"
import { types } from "node:util"
import { BaseError } from "../utils/errors.js"

type NestedAttributes = {
  [key: string]: NestedAttributes | AttributeValue | Date | ObjectId | null
}

export function setAttributes(attributes: NestedAttributes, span?: Span) {
  span ??= trace.getActiveSpan()
  if (span == null) return
  for (const [key, value] of Object.entries(flattenAttributes(attributes))) {
    if (value == null) continue
    span.setAttribute(key, value)
  }
}

type RecordExceptionOptions = {
  span?: Span
  setStatus?: boolean
}
export function recordException(error: unknown, options: RecordExceptionOptions = {}) {
  const span = options.span ?? trace.getActiveSpan()
  if (span == null) return

  const e = error instanceof Error ? error : `Caught object not instance of Error: ${error}`
  span.recordException(e)
  if (options.setStatus ?? true) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: e instanceof Error ? e.message : e })
  }
}

type SpanOptions = {
  endOnSuccess?: boolean
  endOnError?: boolean
}
export function withSpan<TParams extends unknown[], TReturn>(tracer: Tracer, name: string, func: (...params: TParams) => Promise<TReturn> | TReturn, options?: SpanOptions) {
  return (...params: TParams) => executeSpan(tracer, name, () => func(...params), options)
}

export function executeSpan<TReturn>(tracer: Tracer, name: string, func: () => Promise<TReturn> | TReturn, options?: SpanOptions) {
  return tracer.startActiveSpan(name, span => {
    function onError(error: unknown) {
      recordException(error, { span, setStatus: !(error instanceof BaseError && error.status < 500) })
      if (options?.endOnError ?? true) {
        span.end()
      }
      throw error
    }

    function onSuccess(result: TReturn) {
      if (options?.endOnSuccess ?? true) {
        span.end()
      }
      return result
    }
    
    try {
      const result = func()
      if (types.isPromise(result)) {
        return result.then(onSuccess).catch(onError)
      }
      return onSuccess(result)
    } catch (error) {
      onError(error)
    }
  })
}

function flattenAttributes(
  obj: NestedAttributes,
  parentKey: string | null = null,
  result: Record<string, AttributeValue> = {}
): Record<string, AttributeValue> {
  for (const [key, value] of Object.entries(obj)) {
    if (value == null) continue
    const fullKey = parentKey == null ? key : `${parentKey}.${key}`
    if (value instanceof Date) {
      result[fullKey] = value.toISOString()
    } else if (value instanceof ObjectId) {
      result[fullKey] = `ObjectId(${value.toString()})`
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      flattenAttributes(value, fullKey, result)
    } else {
      result[fullKey] = value
    }
  }
  return result
}
