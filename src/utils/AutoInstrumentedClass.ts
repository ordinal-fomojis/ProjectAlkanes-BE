import { trace } from "@opentelemetry/api"
import { withSpan } from "../instrumentation/span.js"

export abstract class AutoInstrumentedClass {
  private tracer = trace.getTracer(this.constructor.name)
  
  constructor() {
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
    const untypedThis = this as unknown as Record<string, (...args: unknown[]) => unknown>
    for (const method of methods) {
      const original = untypedThis[method]
      if (typeof original === 'function' && method !== 'constructor') {
        untypedThis[method] = withSpan(this.tracer, method, original.bind(this))
      }
    }
  }
}
