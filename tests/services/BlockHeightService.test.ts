import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB_NAME } from '../../src/config/constants.js'
import { database } from '../../src/config/database.js'
import { BlockHeightService } from '../../src/services/BlockHeightService.js'

let mongodb: MongoMemoryServer
beforeAll(async () => {
  mongodb = await MongoMemoryServer.create()
  await database.connect(mongodb.getUri(), DB_NAME)
})

afterAll(async () => {
  await database.disconnect()
  await mongodb.stop()
})

interface BlockHeight {
  name: string
  height: number
}

interface SetupArgs {
  initialData?: { name: string, height: number }[]
}

async function setup({ initialData }: SetupArgs = {}) {
  const service = new BlockHeightService()
  const collection = database.getDb().collection<BlockHeight>(service.collectionName)
  
  await collection.deleteMany({})
  
  if (initialData?.length) {
    await collection.insertMany(initialData)
  }
  
  return { service, collection }
}

describe('BlockHeightService', () => {
  describe('getBlockHeight', () => {
    it('should return null when block height does not exist', async () => {
      const { service } = await setup()
      
      const height = await service.getBlockHeight('token_sync')
      
      expect(height).toBeNull()
    })
    
    it('should return the block height when it exists', async () => {
      const blockName = 'token_sync'
      const blockHeight = 123456
      const { service } = await setup({
        initialData: [{ name: blockName, height: blockHeight }]
      })
      
      const height = await service.getBlockHeight(blockName)
      
      expect(height).toBe(blockHeight)
    })
  })
  
  describe('setBlockHeight', () => {
    it('should create a new block height when it does not exist', async () => {
      const blockName = 'token_sync'
      const blockHeight = 123456
      const { service, collection } = await setup()
      
      await service.setBlockHeight(blockName, blockHeight)
      
      const result = await collection.find().toArray()
      expect(result).toEqual([{
        _id: expect.any(ObjectId),
        name: blockName,
        height: blockHeight
      }])
    })
    
    it('should update an existing block height', async () => {
      const blockName = 'token_sync'
      const initialHeight = 123456
      const newHeight = 789012
      const { service, collection } = await setup({
        initialData: [{ name: blockName, height: initialHeight }]
      })
      
      await service.setBlockHeight(blockName, newHeight)
      
      const result = await collection.find().toArray()
      expect(result).toEqual([{
        _id: expect.any(ObjectId),
        name: blockName,
        height: newHeight
      }])
    })
    
    it('should handle multiple block heights independently', async () => {
      const block1 = { name: 'name1', height: 100000 }
      const block2 = { name: 'name2', height: 200000 }
      const { service, collection } = await setup({
        initialData: [block1]
      })
      
      await service.setBlockHeight(block2.name, block2.height)
      
      const results = await collection.find().sort({ name: 'asc' }).toArray()
      expect(results).toEqual([
        { _id: expect.any(ObjectId), name: block1.name, height: block1.height },
        { _id: expect.any(ObjectId), name: block2.name, height: block2.height }
      ])
    })
  })
})
