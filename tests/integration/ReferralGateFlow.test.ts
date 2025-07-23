import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { DB_NAME } from '../../src/config/constants.js'
import { database } from '../../src/config/database.js'
import { PointsService } from '../../src/services/PointsService.js'
import { ReferralService } from '../../src/services/referralService.js'
import { UserService } from '../../src/services/userService.js'
import { randomAddress } from '../test-utils/btc-random.js'

let mongodb: MongoMemoryServer

describe('Referral Gate Integration Flow', () => {
  const userService = new UserService()
  const referralService = new ReferralService()
  const pointsService = new PointsService()

  beforeAll(async () => {
    mongodb = await MongoMemoryServer.create()
    await database.connect(mongodb.getUri(), DB_NAME)
  })

  afterAll(async () => {
    await database.disconnect()
    await mongodb.stop()
  })

  beforeEach(async () => {
    // Clean up test data
    await database.getDb().collection('users').deleteMany({})
  })

  describe('Bootstrap System', () => {
    it('should allow first users to join via BOOTSTRAP code', async () => {
      // 1. Create new user (unreferred)
      const userWallet = randomAddress()
      const user = await userService.createUser({ walletAddress: userWallet })
      
      // Verify user starts unreferred
      expect(user.referredBy).toBeUndefined()

      // 2. User enters BOOTSTRAP code
      const bootstrapResult = await referralService.enterReferralCode(userWallet, 'BOOTSTRAP')
      expect(bootstrapResult.success).toBe(true)
      expect(bootstrapResult.message).toBe('Bootstrap referral code applied successfully')

      // 3. Verify user is now "referred" by bootstrap system
      const updatedUser = await userService.getUserByWalletAddress(userWallet)
      expect(updatedUser?.referredBy).toEqual(new ObjectId('000000000000000000000001'))

      // 4. User should now be able to see their referral code
      const referralInfo = await referralService.getReferralInfo(userWallet)
      expect(referralInfo?.referralCode).toBeDefined()
      expect(referralInfo?.referralCode).toMatch(/^[A-Z0-9]{6}$/)
    })

    it('should prevent double application of bootstrap code', async () => {
      const userWallet = randomAddress()
      await userService.createUser({ walletAddress: userWallet })

      // First application succeeds
      const firstResult = await referralService.enterReferralCode(userWallet, 'BOOTSTRAP')
      expect(firstResult.success).toBe(true)

      // Second application fails
      const secondResult = await referralService.enterReferralCode(userWallet, 'BOOTSTRAP')
      expect(secondResult.success).toBe(false)
      expect(secondResult.message).toBe('User is already referred')
    })
  })

  describe('Referral Code Visibility', () => {
    it('should hide referral codes from unreferred users', async () => {
      // Create unreferred user
      const userWallet = randomAddress()
      await userService.createUser({ walletAddress: userWallet })

      // Check referral info
      const referralInfo = await referralService.getReferralInfo(userWallet)
      expect(referralInfo?.referralCode).toBeUndefined()
      expect(referralInfo?.customReferralId).toBeUndefined()
             expect(referralInfo?.referredBy).toBeUndefined()
    })

    it('should show referral codes to referred users', async () => {
      // Create and setup referred user
      const userWallet = randomAddress()
      await userService.createUser({ walletAddress: userWallet })
      await referralService.enterReferralCode(userWallet, 'BOOTSTRAP')

      // Check referral info
      const referralInfo = await referralService.getReferralInfo(userWallet)
      expect(referralInfo?.referralCode).toBeDefined()
      expect(referralInfo?.referralCode).toMatch(/^[A-Z0-9]{6}$/)
      expect(referralInfo?.referredBy).toBeDefined()
    })
  })

  describe('Real Referral Flow', () => {
    it('should allow referred users to refer others', async () => {
      // 1. Create referrer (use bootstrap)
      const referrerWallet = randomAddress()
      const referrer = await userService.createUser({ walletAddress: referrerWallet })
      await referralService.enterReferralCode(referrerWallet, 'BOOTSTRAP')

      // 2. Create new user
      const newUserWallet = randomAddress()
      await userService.createUser({ walletAddress: newUserWallet })

      // 3. New user enters referrer's code
      const referralResult = await referralService.enterReferralCode(newUserWallet, referrer.referralCode!)
      expect(referralResult.success).toBe(true)
      expect(referralResult.message).toBe('Referral code applied successfully')

      // 4. Verify relationship
      const newUserInfo = await referralService.getReferralInfo(newUserWallet)
      expect(newUserInfo?.referredBy?.walletAddress).toBe(referrerWallet)

      const referrerInfo = await referralService.getReferralInfo(referrerWallet)
      expect(referrerInfo?.totalReferrals).toBe(1)
      expect(referrerInfo?.referredUsers[0]?.walletAddress).toBe(newUserWallet)

      // 5. New user should now see their referral code
      expect(newUserInfo?.referralCode).toBeDefined()
    })

    it('should prevent self-referral', async () => {
      const userWallet = randomAddress()
      const user = await userService.createUser({ walletAddress: userWallet })
      await referralService.enterReferralCode(userWallet, 'BOOTSTRAP')

      // Try to refer themselves
      const result = await referralService.enterReferralCode(userWallet, user.referralCode!)
      expect(result.success).toBe(false)
      expect(result.message).toBe('User is already referred')
    })
  })

  describe('Points Integration with Referral Gate', () => {
    it('should award referral points when referred user mints', async () => {
      // Setup referrer and referred user
      const referrerWallet = randomAddress()
      const referrer = await userService.createUser({ walletAddress: referrerWallet })
      await referralService.enterReferralCode(referrerWallet, 'BOOTSTRAP')

      const minterWallet = randomAddress()
      await userService.createUser({ walletAddress: minterWallet })
      await referralService.enterReferralCode(minterWallet, referrer.referralCode!)

      // Simulate minting by referred user
      const mintResult = await pointsService.awardReferralPoints(
        minterWallet,
        5, // mint count
        new ObjectId()
      )

      expect(mintResult.awarded).toBe(true)
      expect(mintResult.referrerWallet).toBe(referrerWallet)
      expect(mintResult.pointsAwarded).toBe(5) // 1 point per mint

      // Check referrer received points
      const referrerPoints = await pointsService.getPointsBalance(referrerWallet)
      expect(referrerPoints).toBe(5)
    })

    it('should not award referral points for unreferred users', async () => {
      const minterWallet = randomAddress()
      await userService.createUser({ walletAddress: minterWallet })
      // Note: User is NOT referred

      const mintResult = await pointsService.awardReferralPoints(
        minterWallet,
        5,
        new ObjectId()
      )

      expect(mintResult.awarded).toBe(false)
      expect(mintResult.referrerWallet).toBeUndefined()
    })
  })

  describe('Custom Referral Links', () => {
    it('should allow referred users to create custom links', async () => {
      const userWallet = randomAddress()
      await userService.createUser({ walletAddress: userWallet })
      await referralService.enterReferralCode(userWallet, 'BOOTSTRAP')

      const result = await referralService.createCustomReferralLink(userWallet, 'mycoollink')
      expect(result.success).toBe(true)
      expect(result.message).toBe('Custom referral link created successfully')

      // Verify custom link is visible
      const referralInfo = await referralService.getReferralInfo(userWallet)
      expect(referralInfo?.customReferralId).toBe('mycoollink')
    })

    it('should prevent unreferred users from creating custom links via gate', async () => {
      const userWallet = randomAddress()
      await userService.createUser({ walletAddress: userWallet })
      // Note: User is NOT referred

      // This would normally be blocked by middleware, but we test the gate function directly
      const { requireReferralForReferralAction } = await import('../../src/middleware/referralGate.js')
      const gateResult = await requireReferralForReferralAction(userWallet)
      
      expect(gateResult.allowed).toBe(false)
      expect(gateResult.message).toContain('must be referred')
    })
  })

  describe('Tier Progression with Referrals', () => {
    it('should calculate tiers based on total points including referral rewards', async () => {
      // Setup referrer
      const referrerWallet = randomAddress()
      const referrer = await userService.createUser({ walletAddress: referrerWallet })
      await referralService.enterReferralCode(referrerWallet, 'BOOTSTRAP')

      // Award initial mint points to referrer (900 points - still Common tier)
      await pointsService.addPoints(referrerWallet, 900)

      // Setup multiple referred users who will mint
      const referredUsers = []
      for (let i = 0; i < 10; i++) {
        const referredWallet = randomAddress()
        await userService.createUser({ walletAddress: referredWallet })
        await referralService.enterReferralCode(referredWallet, referrer.referralCode!)
        referredUsers.push(referredWallet)
      }

      // Each referred user mints 10 tokens (gives referrer 10 points each = 100 total)
      for (const wallet of referredUsers) {
        await pointsService.awardReferralPoints(wallet, 10, new ObjectId())
      }

      // Referrer should now have 900 + 100 = 1000 points = Uncommon tier
      const referrerInfo = await referralService.getReferralInfo(referrerWallet)
      expect(referrerInfo?.points).toBe(1000)
      expect(referrerInfo?.tier.level).toBe('Uncommon')
      expect(referrerInfo?.tier.bonus).toBe(1.2)
      expect(referrerInfo?.pointsEarnedFromReferrals).toBe(100)
    })
  })
}) 
