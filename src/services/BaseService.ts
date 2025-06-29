import { Collection, Document } from "mongodb"
import { database } from "../config/database.js"

export abstract class BaseService<T extends Document> {
  abstract readonly collectionName: string
  private _collection?: Collection<T>

  protected get collection(): Collection<T> {
    this._collection ??= database.getDb().collection<T>(this.collectionName)
    return this._collection
  }
}
