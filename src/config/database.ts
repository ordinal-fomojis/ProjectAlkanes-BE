import { ClientSession, Db, MongoClient, WithTransactionCallback } from 'mongodb'

class Database {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  async connect(uri: string, dbName: string) {
    try {
      this.client ??= new MongoClient(uri)
      await this.client.connect();
      this.db = this.client.db(dbName);
      console.log('✅ Connected to MongoDB');
      console.log(`📊 Database: ${dbName}`);
      
      // Create indexes for optimal sorting performance
      await this.createIndexes();
    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      await this.client?.close();
      console.log('🔌 Disconnected from MongoDB');
    } catch (error) {
      console.error('❌ Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  get isConnected(): boolean {
    return this.db != null
  }

  getDb(): Db {
    if (this.db == null) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  async withTransaction<T>(
    callback: WithTransactionCallback<T>, options?: Parameters<ClientSession['withTransaction']>[1]
  ) {
    if (this.client == null) {
      throw new Error('Database client not initialized. Call connect() first.');
    }
    const session = this.client.startSession()
    try {
      return await session.withTransaction(callback, options)
    } finally {
      await session.endSession()
    }
  }

  private async createIndexes() {
    if (!this.db) return;
    
    const collection = this.db.collection('alkane_tokens');
    
    try {
      // Create composite indexes for optimal sorting performance
      await collection.createIndex({ currentMintCount: 1, deployTimestamp: -1 });
      await collection.createIndex({ pendingMints: 1, deployTimestamp: -1 });
      
      // Create indexes for other sortable fields
      await collection.createIndex({ percentageMinted: 1 });
      await collection.createIndex({ mintCountCap: 1 });
      await collection.createIndex({ name: 1 });
      await collection.createIndex({ symbol: 1 });
      await collection.createIndex({ deployTimestamp: -1 });
      
      // Create indexes for filtering
      await collection.createIndex({ mintable: 1 });
      await collection.createIndex({ mintedOut: 1 });
      await collection.createIndex({ preminedSupply: 1 });
      await collection.createIndex({ maxSupply: 1 });
      
      console.log('✅ Database indexes created successfully');
    } catch (error) {
      console.error('❌ Error creating database indexes:', error);
      // Don't throw error as indexes might already exist
    }
  }
}

export const database = new Database()
