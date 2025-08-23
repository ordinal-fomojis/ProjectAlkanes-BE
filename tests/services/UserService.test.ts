import { MongoMemoryServer } from "mongodb-memory-server"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { DB_NAME } from "../../src/config/env.js"
import { database } from "../../src/database/database.js"
import { UserService } from "../../src/services/userService.js"
import { randomAddress } from "../test-utils/btc-random.js"

let mongodb: MongoMemoryServer
beforeAll(async () => {
  mongodb = await MongoMemoryServer.create()
  await database.connect(mongodb.getUri(), DB_NAME())
})

afterAll(async () => {
  await database.disconnect()
  await mongodb.stop()
})

describe('UserService.createUser', () => {
  const userService = new UserService()

  it('should create a new user with all required fields', async () => {
    const walletAddress = randomAddress()
    const userData = { walletAddress }

    const user = await userService.createUser(userData)

    expect(user).toBeDefined()
    expect(user._id).toBeDefined()
    expect(user.walletAddress).toBe(walletAddress)
    expect(user.createdAt).toBeInstanceOf(Date)
    expect(user.lastLoginAt).toBeInstanceOf(Date)
    expect(user.referralCode).toBeDefined()
    expect(user.referralCode).toMatch(/^[A-Z0-9]{6}$/)
    expect(user.points).toBe(0)
    expect(user.pointsEarnedFromReferrals).toBe(0)

    await database.getDb().collection(userService.collectionName).deleteOne({ _id: user._id })
  })

  it('should prevent duplicate users and only update lastLoginAt', async () => {
    const walletAddress = randomAddress()
    const userData = { walletAddress }

    const firstUser = await userService.createUser(userData)
    const originalCreatedAt = firstUser.createdAt
    const originalReferralCode = firstUser.referralCode

    await database.getDb().collection('users').updateOne(
      { _id: firstUser._id },
      { 
        $set: { 
          points: 100,
          pointsEarnedFromReferrals: 50,
          customReferralId: 'custom-id'
        } 
      }
    )

    // Wait a moment to ensure lastLoginAt will be different
    await new Promise(resolve => setTimeout(resolve, 10))

    const secondUser = await userService.createUser(userData)

    expect(secondUser._id.toString()).toBe(firstUser._id.toString())
    expect(secondUser.walletAddress).toBe(firstUser.walletAddress)
    expect(secondUser.createdAt).toEqual(originalCreatedAt)
    expect(secondUser.referralCode).toBe(originalReferralCode)
    expect(secondUser.points).toBe(100)
    expect(secondUser.pointsEarnedFromReferrals).toBe(50)
    expect(secondUser.customReferralId).toBe('custom-id')
    expect(secondUser.lastLoginAt!.getTime()).toBeGreaterThan(firstUser.lastLoginAt!.getTime())

    await database.getDb().collection(userService.collectionName).deleteOne({ _id: firstUser._id })
  })

  it('should generate unique referral codes for different users', async () => {
    const user1 = await userService.createUser({ walletAddress: randomAddress() })
    const user2 = await userService.createUser({ walletAddress: randomAddress() })

    expect(user1.referralCode).toBeDefined()
    expect(user2.referralCode).toBeDefined()
    expect(user1.referralCode).not.toBe(user2.referralCode)

    await database.getDb().collection(userService.collectionName).deleteMany({ _id: { $in: [user1._id, user2._id] } })
  })

  it.each(
    ['p2tr', 'p2wpkh'] as const
  )('should handle case-insensitive duplicate detection', async (addressType) => {
    const baseAddress = randomAddress(addressType)

    const firstUser = await userService.createUser({ walletAddress: baseAddress })
    const secondUser = await userService.createUser({ walletAddress: baseAddress.toUpperCase() })

    expect(secondUser._id.toString()).toBe(firstUser._id.toString())

    await database.getDb().collection(userService.collectionName).deleteOne({ _id: firstUser._id })
  })
})
