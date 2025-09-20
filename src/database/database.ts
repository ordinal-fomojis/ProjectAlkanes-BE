import { ClientSession, Db, MongoClient, WithTransactionCallback } from 'mongodb'
import { AutoInstrumentedClass } from '../instrumentation/AutoInstrumentedClass.js'
import { setAttributes } from '../instrumentation/instrumentation.js'
import { ServerError } from '../utils/errors.js'
import { initIndexes } from './indexes.js'

class Database extends AutoInstrumentedClass {
  private client: MongoClient | null = null
  private db: Db | null = null

  async connect(uri: string, dbName: string, initialiseIndexes = true) {
    this.client ??= new MongoClient(uri)
    setAttributes({ dbName, initialiseIndexes })
    await this.client.connect()
    const db = this.client.db(dbName)
    if (initialiseIndexes) {
      await initIndexes(db)
    }
    this.db = db
  }

  async disconnect() {
    await this.client?.close()
  }

  get isConnected(): boolean {
    return this.db != null
  }

  getDb() {
    if (this.db == null) {
      throw new ServerError('Database not connected. Call connect() first.')
    }
    return this.db
  }

  async withTransaction<T>(
    callback: WithTransactionCallback<T>, options?: Parameters<ClientSession['withTransaction']>[1]
  ) {
    if (this.client == null) {
      throw new ServerError('Database client not initialized. Call connect() first.')
    }
    const session = this.client.startSession()
    try {
      return await session.withTransaction(callback, options)
    } finally {
      await session.endSession()
    }
  }
}

export const database = new Database()
