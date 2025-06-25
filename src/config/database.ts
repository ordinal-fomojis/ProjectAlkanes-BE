import { Db, MongoClient } from 'mongodb'

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

  getDb(): Db {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }
}

export const database = new Database()
