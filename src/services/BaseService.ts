import { trace } from "@opentelemetry/api"
import { Collection, Document } from "mongodb"
import { DatabaseCollection } from "../database/collections.js"
import { database } from "../database/database.js"
import { withSpan } from "../instrumentation/span.js"

export abstract class BaseService<T extends Document> {
  abstract readonly collectionName: DatabaseCollection
  private _collection?: Collection<T>
  private tracer = trace.getTracer(this.constructor.name)

  constructor() {
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    const untypedThis = this as unknown as Record<string, Function>
    for (const method of methods) {
      const original = untypedThis[method]
      if (typeof original === 'function' && method !== 'constructor') {
        untypedThis[method] = withSpan(this.tracer, method, original.bind(this))
      }
    }
  }

  protected get collection(): Collection<T> {
    this._collection ??= database.getDb().collection<T>(this.collectionName)
    return this._collection
  }
}
