import { Collection, Document } from "mongodb"
import { DatabaseCollection } from "../database/collections.js"
import { database } from "../database/database.js"

export abstract class BaseService<T extends Document> {
  abstract readonly collectionName: DatabaseCollection
  private _collection?: Collection<T>

  protected get collection(): Collection<T> {
    this._collection ??= database.getDb().collection<T>(this.collectionName)
    return this._collection
  }
}
