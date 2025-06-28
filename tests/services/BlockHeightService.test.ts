import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB_NAME } from '../../src/config/constants.js'
import { database } from '../../src/config/database.js'
import { BlockHeight, BlockHeightService } from '../../src/services/BlockHeightService.js'

let mongodb: MongoMemoryServer
beforeAll(async () => {
  mongodb = await MongoMemoryServer.create()
  await database.connect(mongodb.getUri(), DB_NAME)
})

afterAll(async () => {
  await database.disconnect()
  await mongodb.stop()
})

interface SetupArgs {
  initialData?: { height: number, synced: boolean }[]
}

async function setup({ initialData }: SetupArgs = {}) {
  const service = new BlockHeightService()
  const collection = database.getDb().collection<BlockHeight>(service.collectionName)
  
  await collection.deleteMany({})
  
  if (initialData?.length) {
    await collection.insertMany(initialData.map(data => ({ ...data, timestamp: new Date() })))
  }
  
  return { service, collection }
}

describe('BlockHeightService', () => {
  describe('getBlockHeight', () => {
    it('should return null when block height does not exist', async () => {
      const { service } = await setup()
      
      const height = await service.getBlockHeight()
      
      expect(height).toBeNull()
    })
    
    it('should return the maximum block height when it exists', async () => {
      const { service } = await setup({
        initialData: [
          { height: 123456, synced: true },
          { height: 234456, synced: true },
          { height: 12345, synced: true },
        ]
      })
      
      const height = await service.getBlockHeight()
      
      expect(height).toMatchObject({ height: 234456 })
    })
  })
  
  describe('setBlockHeight', () => {
    it('should create a new block height when it does not exist', async () => {
      const blockHeight = 123456
      const { service, collection } = await setup()
      
      await service.setBlockHeights([{ height: blockHeight, synced: true, timestamp: new Date() }])
      
      const result = await collection.find().toArray()
      expect(result).toEqual([{
        _id: expect.any(ObjectId),
        height: blockHeight,
        synced: true,
        timestamp: expect.any(Date)
      }])
    })
    
    it('should update an existing block height', async () => {
      const height = 123456
      const { service, collection } = await setup({
        initialData: [{ height, synced: true }]
      })
      
      await service.setBlockHeights([{ height, synced: false, timestamp: new Date() }])
      
      const result = await collection.find().toArray()
      expect(result).toEqual([{
        _id: expect.any(ObjectId),
        height,
        synced: false,
        timestamp: expect.any(Date)
      }])
    })
    
    it('should handle create and update in the same call', async () => {
      const { service, collection } = await setup({
        initialData: [{ height: 123456, synced: true }]
      })
      
      await service.setBlockHeights([
        { height: 123456, synced: false, timestamp: new Date() }, // Update
        { height: 234567, synced: true, timestamp: new Date() } // Create
      ])
      
      const result = await collection.find().toArray()
      expect(result).toEqual([
        {
          _id: expect.any(ObjectId),
          height: 123456,
          synced: false,
          timestamp: expect.any(Date)
        },
        {
          _id: expect.any(ObjectId),
          height: 234567,
          synced: true,
          timestamp: expect.any(Date)
        }
      ])
    })
  })
})
