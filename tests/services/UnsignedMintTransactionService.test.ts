import { MongoMemoryServer } from "mongodb-memory-server"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { DB_NAME } from "../../src/config/constants.js"
import { database } from "../../src/database/database.js"
import { UnsignedMintTransactionService } from "../../src/services/UnsignedMintTransactionService.js"
import { randomAddress } from "../test-utils/btc-random.js"
import Random from "../test-utils/Random.js"

let mongodb: MongoMemoryServer
beforeAll(async () => {
  mongodb = await MongoMemoryServer.create()
  await database.connect(mongodb.getUri(), DB_NAME)
})

afterAll(async () => {
  await database.disconnect()
  await mongodb.stop()
})

describe('UnsignedMintTransactionService', () => {
  it('should create a mint transaction and retrieve by id', async () => {
    const service = new UnsignedMintTransactionService()
    const mintTx = {
      psbt: Random.randomHex(100),
      wif: Random.randomHex(64),
      serviceFee: 100,
      networkFee: 50,
      paddingCost: 10,
      networkFeePerMint: 5,
      networkFeeOfFinalMint: 10,
      mintsInEachOutput: [1, 2, 3],
      alkaneId: '2:0',
      mintCount: 6,
      paymentAddress: randomAddress(),
      receiveAddress: randomAddress(),
    }
    const id = await service.createMintTransaction(mintTx)
    const createdTx = await service.getMintTransactionById(id)
    expect(createdTx).toBeDefined()
    expect(createdTx?.psbt).toBe(mintTx.psbt)
    expect(createdTx?.wif).toBe(mintTx.wif)
    expect(createdTx?.serviceFee).toBe(mintTx.serviceFee)
    expect(createdTx?.networkFee).toBe(mintTx.networkFee)
    expect(createdTx?.paddingCost).toBe(mintTx.paddingCost)
    expect(createdTx?.totalCost).toBe(mintTx.serviceFee + mintTx.networkFee + mintTx.paddingCost)
    expect(createdTx?.networkFeePerMint).toBe(mintTx.networkFeePerMint)
    expect(createdTx?.mintsInEachOutput).toEqual(mintTx.mintsInEachOutput)
    expect(createdTx?.alkaneId).toBe(mintTx.alkaneId)
    expect(createdTx?.mintCount).toBe(mintTx.mintCount)
    expect(createdTx?.paymentAddress).toBe(mintTx.paymentAddress)
    expect(createdTx?.receiveAddress).toBe(mintTx.receiveAddress)
    expect(createdTx?.created).toBeInstanceOf(Date)
  })
})
