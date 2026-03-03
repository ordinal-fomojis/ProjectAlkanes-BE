import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { DB_NAME } from '../../src/config/env-vars.js'
import { calculateBonusPoints, getTierByPoints } from '../../src/config/tiers.js'
import { DatabaseCollection } from '../../src/database/collections.js'
import { database } from "../../src/database/database.js"
import { PointsService } from '../../src/services/PointsService.js'
import { ReferralService } from '../../src/services/referralService.js'
import { UserService } from '../../src/services/userService.js'
import { randomAddress } from '../test-utils/btc-random.js'

let mongodb: MongoMemoryServer

describe('Tier Calculation with Total Points System', () => {
  const userService = new UserService()
  const referralService = new ReferralService()
  const pointsService = new PointsService()

  beforeAll(async () => {
    mongodb = await MongoMemoryServer.create()
    await database.connect(mongodb.getUri(), DB_NAME())
  })

  afterAll(async () => {
    await database.disconnect()
    await mongodb.stop()
  })

  beforeEach(async () => {
    await database.getDb().collection(DatabaseCollection.Users).deleteMany({})
  })

  describe('Tier Calculation Logic', () => {
    it('should correctly calculate tiers based on total points', () => {
      // Test all tier thresholds
      expect(getTierByPoints(0)).toMatchObject({ level: 'Common', bonus: 1.0 })
      expect(getTierByPoints(9999)).toMatchObject({ level: 'Common', bonus: 1.0 })
      expect(getTierByPoints(10000)).toMatchObject({ level: 'Uncommon', bonus: 1.2 })
      expect(getTierByPoints(49999)).toMatchObject({ level: 'Uncommon', bonus: 1.2 })
      expect(getTierByPoints(50000)).toMatchObject({ level: 'Rare', bonus: 1.5 })
      expect(getTierByPoints(199999)).toMatchObject({ level: 'Rare', bonus: 1.5 })
      expect(getTierByPoints(200000)).toMatchObject({ level: 'Epic', bonus: 2.0 })
      expect(getTierByPoints(499999)).toMatchObject({ level: 'Epic', bonus: 2.0 })
      expect(getTierByPoints(500000)).toMatchObject({ level: 'Legendary', bonus: 2.5 })
      expect(getTierByPoints(1000000)).toMatchObject({ level: 'Legendary', bonus: 2.5 })
    })

    it('should calculate bonus points correctly for each tier', () => {
      // Common tier (1.0x)
      expect(calculateBonusPoints(10, getTierByPoints(0))).toBe(10)
      
      // Uncommon tier (1.2x)
      expect(calculateBonusPoints(10, getTierByPoints(10000))).toBe(12)
      
      // Rare tier (1.5x)
      expect(calculateBonusPoints(10, getTierByPoints(50000))).toBe(15)
      
      // Epic tier (2.0x)
      expect(calculateBonusPoints(10, getTierByPoints(200000))).toBe(20)
      
      // Legendary tier (2.5x)
      expect(calculateBonusPoints(10, getTierByPoints(500000))).toBe(25)
      
      // Test fractional results (should floor)
      expect(calculateBonusPoints(3, getTierByPoints(10000))).toBe(3) // 3 * 1.2 = 3.6 -> 3
      expect(calculateBonusPoints(7, getTierByPoints(10000))).toBe(8) // 7 * 1.2 = 8.4 -> 8
    })
  })

  describe('User Tier Progression Scenarios', () => {
    it('should progress user through tiers via mint points only', async () => {
      const userWallet = randomAddress()
      await userService.createUser({ walletAddress: userWallet })
      await referralService.enterReferralCode(userWallet, 'BOOTSTRAP')

      // Start: Common tier (0 points)
      let userInfo = await referralService.getReferralInfo(userWallet)
      expect(userInfo?.tier.level).toBe('Common')
      expect(userInfo?.points).toBe(0)

      // Award 10000 mint points → Uncommon tier
      await pointsService.addPoints(userWallet, 10000)
      userInfo = await referralService.getReferralInfo(userWallet)
      expect(userInfo?.tier.level).toBe('Uncommon')
      expect(userInfo?.points).toBe(10000)
      expect(userInfo?.pointsEarnedFromReferrals).toBe(0) // Still 0 referral points

      // Award 40000 more points → Rare tier
      await pointsService.addPoints(userWallet, 40000)
      userInfo = await referralService.getReferralInfo(userWallet)
      expect(userInfo?.tier.level).toBe('Rare')
      expect(userInfo?.points).toBe(50000)
    })

    it('should progress user through tiers via referral points only', async () => {
      const referrerWallet = randomAddress()
      await userService.createUser({ walletAddress: referrerWallet })
      await referralService.enterReferralCode(referrerWallet, 'BOOTSTRAP')

      // Create many referred users who will mint
      const referredUsers = []
      for (let i = 0; i < 50; i++) {
        const wallet = randomAddress()
        await userService.createUser({ walletAddress: wallet })
        const referrer = await userService.getUserByWalletAddress(referrerWallet)
        expect(referrer?.referralCode).toBeDefined()
        await referralService.enterReferralCode(wallet, referrer!.referralCode!)
        referredUsers.push(wallet)
      }

      // Each user mints 20 tokens (50 * 20 = 10000 referral points for referrer)
      for (const wallet of referredUsers) {
        await pointsService.awardReferralPoints(wallet, 200, new ObjectId())
      }

      const referrerInfo = await referralService.getReferralInfo(referrerWallet)
      expect(referrerInfo?.points).toBe(10000)
      expect(referrerInfo?.pointsEarnedFromReferrals).toBe(10000)
      expect(referrerInfo?.tier.level).toBe('Uncommon')
    })

    it('should progress user through tiers via mixed points (mint + referral)', async () => {
      const userWallet = randomAddress()
      await userService.createUser({ walletAddress: userWallet })
      await referralService.enterReferralCode(userWallet, 'BOOTSTRAP')

      // Award 7000 mint points
      await pointsService.addPoints(userWallet, 7000)
      
      // Create referred users who mint (3000 referral points)
      for (let i = 0; i < 30; i++) {
        const wallet = randomAddress()
        await userService.createUser({ walletAddress: wallet })
        const user = await userService.getUserByWalletAddress(userWallet)
        expect(user?.referralCode).toBeDefined()
        await referralService.enterReferralCode(wallet, user!.referralCode!)
        await pointsService.awardReferralPoints(wallet, 100, new ObjectId())
      }

      const userInfo = await referralService.getReferralInfo(userWallet)
      expect(userInfo?.points).toBe(10000) // 7000 mint + 3000 referral
      expect(userInfo?.pointsEarnedFromReferrals).toBe(3000)
      expect(userInfo?.tier.level).toBe('Uncommon')
    })
  })

  describe('Tier Bonus Application', () => {
    it('should apply tier bonuses to new points based on current total', async () => {
      const userWallet = randomAddress()
      await userService.createUser({ walletAddress: userWallet })
      await referralService.enterReferralCode(userWallet, 'BOOTSTRAP')

      // Give user 15000 points (Uncommon tier)
      await pointsService.addPoints(userWallet, 15000)

      // Award mint points with tier bonus
      const mintResult = await pointsService.awardMintPoints(userWallet, 1, 10) // 1 mint * 10 base
      expect(mintResult.pointsAwarded).toBe(12) // 10 * 1.2 Uncommon bonus
      expect(mintResult.tier).toBe('Uncommon')
      expect(mintResult.bonus).toBe(1.2)

      // Total should be 15000 + 12 = 15012
      const finalPoints = await pointsService.getPointsBalance(userWallet)
      expect(finalPoints).toBe(15012)
    })

    it('should apply tier bonuses to referral points based on referrer total', async () => {
      // Setup high-tier referrer (50000 points = Rare tier)
      const referrerWallet = randomAddress()
      await userService.createUser({ walletAddress: referrerWallet })
      await referralService.enterReferralCode(referrerWallet, 'BOOTSTRAP')
      await pointsService.addPoints(referrerWallet, 50000)

      // Create referred user
      const referredWallet = randomAddress()
      await userService.createUser({ walletAddress: referredWallet })
      const referrer = await userService.getUserByWalletAddress(referrerWallet)
      expect(referrer?.referralCode).toBeDefined()
      await referralService.enterReferralCode(referredWallet, referrer!.referralCode!)

      // Award referral points (should get Rare tier bonus)
      const referralResult = await pointsService.awardReferralPoints(referredWallet, 10, new ObjectId())
      expect(referralResult.awarded).toBe(true)
      expect(referralResult.pointsAwarded).toBe(10) // Referral points are fixed, no tier bonus

      // But referrer with Rare tier gets bonus on their own mints
      const referrerMintResult = await pointsService.awardMintPoints(referrerWallet, 1, 10)
      expect(referrerMintResult.pointsAwarded).toBe(15) // 10 * 1.5 Rare bonus
    })
  })

  describe('Tier Progression Edge Cases', () => {
    it('should handle tier transitions correctly', async () => {
      const userWallet = randomAddress()
      await userService.createUser({ walletAddress: userWallet })
      await referralService.enterReferralCode(userWallet, 'BOOTSTRAP')

      // User at 9999 points (Common tier)
      await pointsService.addPoints(userWallet, 9999)
      let userInfo = await referralService.getReferralInfo(userWallet)
      expect(userInfo?.tier.level).toBe('Common')

      // Add 1 more point → Should become Uncommon
      await pointsService.addPoints(userWallet, 1)
      userInfo = await referralService.getReferralInfo(userWallet)
      expect(userInfo?.tier.level).toBe('Uncommon')
      expect(userInfo?.points).toBe(10000)
    })

    it('should show correct next tier and points needed', async () => {
      const userWallet = randomAddress()
      await userService.createUser({ walletAddress: userWallet })
      await referralService.enterReferralCode(userWallet, 'BOOTSTRAP')

      // User with 12000 points (Uncommon tier)
      await pointsService.addPoints(userWallet, 12000)
      const userInfo = await referralService.getReferralInfo(userWallet)
      
      expect(userInfo?.tier.level).toBe('Uncommon')
      expect(userInfo?.nextTier?.level).toBe('Rare')
      expect(userInfo?.pointsToNextTier).toBe(38000) // 50000 - 12000
    })

    it('should handle max tier users (Legendary)', async () => {
      const userWallet = randomAddress()
      await userService.createUser({ walletAddress: userWallet })
      await referralService.enterReferralCode(userWallet, 'BOOTSTRAP')

      // User with 1M points (Legendary tier)
      await pointsService.addPoints(userWallet, 1000000)
      const userInfo = await referralService.getReferralInfo(userWallet)
      
      expect(userInfo?.tier.level).toBe('Legendary')
             expect(userInfo?.nextTier).toBeUndefined() // No next tier
      expect(userInfo?.pointsToNextTier).toBeUndefined()
    })
  })
}) 
