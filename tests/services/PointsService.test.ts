import { ObjectId } from "mongodb"
import { MongoMemoryServer } from "mongodb-memory-server"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { DB_NAME } from "../../src/config/constants.js"
import { database } from "../../src/config/database.js"
import { PointsService } from "../../src/services/PointsService.js"
import { UserService } from "../../src/services/userService.js"
import { randomAddress } from "../test-utils/btc-random.js"

let mongodb: MongoMemoryServer
beforeAll(async () => {
  mongodb = await MongoMemoryServer.create()
  await database.connect(mongodb.getUri(), DB_NAME)
})

afterAll(async () => {
  await database.disconnect()
  await mongodb.stop()
})

describe('PointsService', () => {
  const pointsService = new PointsService()
  const userService = new UserService()

  it('should award referral points when user was referred', async () => {
    // Create referrer
    const referrerWallet = randomAddress()
    const referrer = await userService.createUser({ walletAddress: referrerWallet })

    // Create referred user
    const minterWallet = randomAddress()
    const minter = await userService.createUser({ walletAddress: minterWallet })

    // Set up referral relationship
    await database.getDb().collection('users').updateOne(
      { _id: minter._id },
      { $set: { referredBy: referrer._id } }
    )

    // Award points for a mint
    const mintCount = 5
    const mintTxId = new ObjectId()
    const result = await pointsService.awardReferralPoints(
      minterWallet,
      mintCount,
      mintTxId
    )

    // Check result
    expect(result.awarded).toBe(true)
    expect(result.referrerWallet).toBe(referrerWallet)
    expect(result.pointsAwarded).toBe(mintCount)

    // Verify points were added to referrer
    const referrerPoints = await pointsService.getPointsBalance(referrerWallet)
    expect(referrerPoints).toBe(mintCount)

    // Verify pointsEarnedFromReferrals was updated
    const updatedReferrer = await pointsService.getUserByWallet(referrerWallet)
    expect(updatedReferrer?.pointsEarnedFromReferrals).toBe(mintCount)
  })

  it('should not award points when user was not referred', async () => {
    // Create user without referrer
    const minterWallet = randomAddress()
    await userService.createUser({ walletAddress: minterWallet })

    // Try to award points
    const mintCount = 3
    const mintTxId = new ObjectId()
    const result = await pointsService.awardReferralPoints(
      minterWallet,
      mintCount,
      mintTxId
    )

    // Should not award points
    expect(result.awarded).toBe(false)
    expect(result.referrerWallet).toBeUndefined()
    expect(result.pointsAwarded).toBeUndefined()
  })

  it('should accumulate points from multiple mints', async () => {
    // Create referrer
    const referrerWallet = randomAddress()
    const referrer = await userService.createUser({ walletAddress: referrerWallet })

    // Create referred user
    const minterWallet = randomAddress()
    const minter = await userService.createUser({ walletAddress: minterWallet })

    // Set up referral relationship
    await database.getDb().collection('users').updateOne(
      { _id: minter._id },
      { $set: { referredBy: referrer._id } }
    )

    // First mint: 3 tokens
    await pointsService.awardReferralPoints(minterWallet, 3, new ObjectId())
    
    // Second mint: 7 tokens
    await pointsService.awardReferralPoints(minterWallet, 7, new ObjectId())

    // Check total points
    const totalPoints = await pointsService.getPointsBalance(referrerWallet)
    expect(totalPoints).toBe(10) // 3 + 7

    // Check cached referral points
    const updatedReferrer = await pointsService.getUserByWallet(referrerWallet)
    expect(updatedReferrer?.pointsEarnedFromReferrals).toBe(10)
  })

  it('should handle case-insensitive wallet addresses', async () => {
    // Create referrer with uppercase address
    const referrerWallet = randomAddress().toUpperCase()
    const referrer = await userService.createUser({ walletAddress: referrerWallet })

    // Create referred user with lowercase address  
    const minterWallet = randomAddress().toLowerCase()
    const minter = await userService.createUser({ walletAddress: minterWallet })

    // Set up referral relationship
    await database.getDb().collection('users').updateOne(
      { _id: minter._id },
      { $set: { referredBy: referrer._id } }
    )

    // Award points
    const result = await pointsService.awardReferralPoints(minterWallet, 2, new ObjectId())
    
    expect(result.awarded).toBe(true)
    
    // Check points with different case
    const points1 = await pointsService.getPointsBalance(referrerWallet.toLowerCase())
    const points2 = await pointsService.getPointsBalance(referrerWallet.toUpperCase())
    expect(points1).toBe(2)
    expect(points2).toBe(2)
  })

  it('should return 0 points for non-existent user', async () => {
    const nonExistentWallet = randomAddress()
    const points = await pointsService.getPointsBalance(nonExistentWallet)
    expect(points).toBe(0)
  })
}) 
