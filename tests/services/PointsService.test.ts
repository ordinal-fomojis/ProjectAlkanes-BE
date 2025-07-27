import { ObjectId } from "mongodb"
import { MongoMemoryServer } from "mongodb-memory-server"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { DB_NAME } from "../../src/config/constants.js"
import { database } from "../../src/database/database.js"
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

  describe('awardMintPoints', () => {
    it('should award base mint points to new user (Common tier)', async () => {
      const minterWallet = randomAddress()
      await userService.createUser({ walletAddress: minterWallet })

      const mintCount = 3
      const result = await pointsService.awardMintPoints(minterWallet, mintCount)

      expect(result.pointsAwarded).toBe(30) // 3 × 10 base points
      expect(result.tier).toBe('Common')
      expect(result.bonus).toBe(1.0)

      // Check user's total points
      const points = await pointsService.getPointsBalance(minterWallet)
      expect(points).toBe(30)

      // Should not affect referral points
      const user = await pointsService.getUserByWallet(minterWallet)
      expect(user?.pointsEarnedFromReferrals).toBe(0)
    })

    it('should award mint points with tier bonus for higher tier user', async () => {
      const minterWallet = randomAddress()
      const user = await userService.createUser({ walletAddress: minterWallet })

      // Manually set referral points to put user in Uncommon tier (threshold: 1000)
      // Need to set both points and pointsEarnedFromReferrals
      await database.getDb().collection('users').updateOne(
        { _id: user._id },
        { $set: { 
          pointsEarnedFromReferrals: 1500,
          points: 1500 
        } }
      )

      const mintCount = 2
      const result = await pointsService.awardMintPoints(minterWallet, mintCount)

      expect(result.pointsAwarded).toBe(24) // 2 × 10 × 1.2 bonus = 24
      expect(result.tier).toBe('Uncommon')
      expect(result.bonus).toBe(1.2)

      // Check user's total points (should be 1500 + 24 = 1524)
      const points = await pointsService.getPointsBalance(minterWallet)
      expect(points).toBe(1524)

      // Referral points should remain unchanged
      const updatedUser = await pointsService.getUserByWallet(minterWallet)
      expect(updatedUser?.pointsEarnedFromReferrals).toBe(1500)
    })

    it('should handle non-existent user gracefully', async () => {
      const nonExistentWallet = randomAddress()

      const mintCount = 2
      const result = await pointsService.awardMintPoints(nonExistentWallet, mintCount)

      expect(result.pointsAwarded).toBe(20) // 2 × 10 base points
      expect(result.tier).toBe('Common')
      expect(result.bonus).toBe(1.0)
    })
  })

  describe('awardFixedReferralPoints', () => {
    it('should award fixed referral points without tier bonus', async () => {
      const referrerWallet = randomAddress()
      const user = await userService.createUser({ walletAddress: referrerWallet })

      // Set user to high tier (should not affect referral rewards)
      // Need to set both points and pointsEarnedFromReferrals
      await database.getDb().collection('users').updateOne(
        { _id: user._id },
        { $set: { 
          pointsEarnedFromReferrals: 25000, // Epic tier (20000+ points)
          points: 25000 
        } }
      )

      const pointsToAward = 5
      const success = await pointsService.awardFixedReferralPoints(
        referrerWallet,
        pointsToAward,
        'Test referral reward'
      )

      expect(success).toBe(true)

      // Check points were added (25000 + 5 = 25005)
      const points = await pointsService.getPointsBalance(referrerWallet)
      expect(points).toBe(25005)

      // Check referral points were updated (25000 + 5 = 25005)
      const updatedUser = await pointsService.getUserByWallet(referrerWallet)
      expect(updatedUser?.pointsEarnedFromReferrals).toBe(25005)
    })

    it('should handle non-existent user', async () => {
      const nonExistentWallet = randomAddress()

      const success = await pointsService.awardFixedReferralPoints(
        nonExistentWallet,
        5,
        'Test referral reward'
      )

      expect(success).toBe(false)
    })
  })

  describe('awardReferralPoints (main flow)', () => {
    it('should award fixed referral points when user was referred', async () => {
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

      // Award points for a mint (5 mints = 5 referral points, fixed)
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
      expect(result.pointsAwarded).toBe(5) // Fixed 1 point per mint

      // Verify points were added to referrer
      const referrerPoints = await pointsService.getPointsBalance(referrerWallet)
      expect(referrerPoints).toBe(5)

      // Verify pointsEarnedFromReferrals was updated
      const updatedReferrer = await pointsService.getUserByWallet(referrerWallet)
      expect(updatedReferrer?.pointsEarnedFromReferrals).toBe(5)
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

    it('should award fixed points regardless of referrer tier', async () => {
      // Create referrer with high tier
      const referrerWallet = randomAddress()
      const referrer = await userService.createUser({ walletAddress: referrerWallet })
      
      // Set referrer to Epic tier (should not affect referral rewards received)
      // Need to set both points and pointsEarnedFromReferrals
      await database.getDb().collection('users').updateOne(
        { _id: referrer._id },
        { $set: { 
          pointsEarnedFromReferrals: 30000, // Epic tier (20000+ points)
          points: 30000 
        } }
      )

      // Create referred user
      const minterWallet = randomAddress()
      const minter = await userService.createUser({ walletAddress: minterWallet })

      // Set up referral relationship
      await database.getDb().collection('users').updateOne(
        { _id: minter._id },
        { $set: { referredBy: referrer._id } }
      )

      // Award points for a mint
      const mintCount = 3
      const result = await pointsService.awardReferralPoints(
        minterWallet,
        mintCount,
        new ObjectId()
      )

      expect(result.awarded).toBe(true)
      expect(result.pointsAwarded).toBe(3) // Still fixed 1 point per mint

      // Check total points (30000 + 3 = 30003)
      const referrerPoints = await pointsService.getPointsBalance(referrerWallet)
      expect(referrerPoints).toBe(30003)
    })
  })

  describe('Complete mint flow', () => {
    it('should award both mint points and referral points correctly', async () => {
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

      // Set minter to Uncommon tier
      // Need to set both points and pointsEarnedFromReferrals
      await database.getDb().collection('users').updateOne(
        { _id: minter._id },
        { $set: { 
          pointsEarnedFromReferrals: 1200, // Uncommon tier (1000+ points)
          points: 1200 
        } }
      )

      const mintCount = 2

      // 1. Award mint points to minter (should get tier bonus)
      const mintResult = await pointsService.awardMintPoints(minterWallet, mintCount)
      expect(mintResult.pointsAwarded).toBe(24) // 2 × 10 × 1.2 = 24
      expect(mintResult.tier).toBe('Uncommon')

      // 2. Award referral points to referrer (should be fixed)
      const referralResult = await pointsService.awardReferralPoints(
        minterWallet,
        mintCount,
        new ObjectId()
      )
      expect(referralResult.awarded).toBe(true)
      expect(referralResult.pointsAwarded).toBe(2) // Fixed 1 point per mint

      // Check final balances
      const minterPoints = await pointsService.getPointsBalance(minterWallet)
      expect(minterPoints).toBe(1224) // 1200 (initial) + 24 (mint bonus) = 1224

      const referrerPoints = await pointsService.getPointsBalance(referrerWallet)
      expect(referrerPoints).toBe(2) // 2 fixed referral points

      // Check referral points tracking
      const minterUser = await pointsService.getUserByWallet(minterWallet)
      expect(minterUser?.pointsEarnedFromReferrals).toBe(1200) // Unchanged from mint

      const referrerUser = await pointsService.getUserByWallet(referrerWallet)
      expect(referrerUser?.pointsEarnedFromReferrals).toBe(2) // From referral
    })
  })

  describe('accumulation and edge cases', () => {
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

      // Check total referral points (fixed rate)
      const totalPoints = await pointsService.getPointsBalance(referrerWallet)
      expect(totalPoints).toBe(10) // 3 + 7 = 10 (fixed rate)

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
      expect(result.pointsAwarded).toBe(2) // Fixed rate
      
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
}) 
