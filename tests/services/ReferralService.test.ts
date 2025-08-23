import { ObjectId } from "mongodb"
import { MongoMemoryServer } from "mongodb-memory-server"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { DB_NAME } from "../../src/config/env.js"
import { database } from "../../src/database/database.js"
import { ReferralService } from "../../src/services/referralService.js"
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

describe('ReferralService', () => {
  const referralService = new ReferralService()
  const userService = new UserService()

  it('should show cached pointsEarnedFromReferrals in referral info', async () => {
    // Create referrer
    const referrerWallet = randomAddress()
    const referrer = await userService.createUser({ walletAddress: referrerWallet })

    // Manually set some cached points (simulating points that were awarded)
    const pointsFromReferrals = 25
    await database.getDb().collection('users').updateOne(
      { _id: referrer._id },
      { 
        $set: { 
          points: 30, // Total points
          pointsEarnedFromReferrals: pointsFromReferrals, // Points from referrals specifically
          referredBy: new ObjectId('000000000000000000000001') // Bootstrap referrer - needed to see referral code
        } 
      }
    )

    // Get referral info
    const referralInfo = await referralService.getReferralInfo(referrerWallet)

    // Verify the cached points are returned
    expect(referralInfo).not.toBeNull()
    expect(referralInfo!.points).toBe(30) // Total points
    expect(referralInfo!.pointsEarnedFromReferrals).toBe(pointsFromReferrals) // Cached referral points
    expect(referralInfo!.referralCode).toBeDefined()
    expect(referralInfo!.totalReferrals).toBe(0) // No referred users yet
  })

  it('should return 0 for pointsEarnedFromReferrals when not set', async () => {
    // Create user without any points
    const userWallet = randomAddress()
    await userService.createUser({ walletAddress: userWallet })

    const referralInfo = await referralService.getReferralInfo(userWallet)

    expect(referralInfo).not.toBeNull()
    expect(referralInfo!.points).toBe(0)
    expect(referralInfo!.pointsEarnedFromReferrals).toBe(0) // Should default to 0
  })

  it('should show referred users in referral info', async () => {
    // Create referrer
    const referrerWallet = randomAddress()
    const referrer = await userService.createUser({ walletAddress: referrerWallet })

    // Create referred users
    const referredWallet1 = randomAddress()
    const referredWallet2 = randomAddress()
    const referred1 = await userService.createUser({ walletAddress: referredWallet1 })
    const referred2 = await userService.createUser({ walletAddress: referredWallet2 })

    // Set up referral relationships
    await database.getDb().collection('users').updateMany(
      { _id: { $in: [referred1._id!, referred2._id!] } },
      { $set: { referredBy: referrer._id! } }
    )

    // Add referred users to referrer's list
    await database.getDb().collection('users').updateOne(
      { _id: referrer._id! },
      { $set: { referredUsers: [referred1._id!, referred2._id!] } }
    )

    const referralInfo = await referralService.getReferralInfo(referrerWallet)

    expect(referralInfo).not.toBeNull()
    expect(referralInfo!.totalReferrals).toBe(2)
    expect(referralInfo!.referredUsers).toHaveLength(2)
    expect(referralInfo!.referredUsers.map(u => u.walletAddress)).toContain(referredWallet1)
    expect(referralInfo!.referredUsers.map(u => u.walletAddress)).toContain(referredWallet2)
  })

  it('should handle custom referral ID in referral info', async () => {
    // Create user with custom referral ID
    const userWallet = randomAddress()
    const user = await userService.createUser({ walletAddress: userWallet })
    const customId = 'mycoollink'

    // FIRST: User must be referred to see their referral codes
    await database.getDb().collection('users').updateOne(
      { _id: user._id! },
      { $set: { 
        customReferralId: customId,
        referredBy: new ObjectId('000000000000000000000001') // Bootstrap referrer
      } }
    )

    const referralInfo = await referralService.getReferralInfo(userWallet)

    expect(referralInfo).not.toBeNull()
    expect(referralInfo!.customReferralId).toBe(customId)
    expect(referralInfo!.referralCode).toBeDefined()
  })

  it('should successfully enter referral code', async () => {
    // Create referrer
    const referrerWallet = randomAddress()
    const referrer = await userService.createUser({ walletAddress: referrerWallet })

    // Create user who will enter referral code
    const userWallet = randomAddress()
    await userService.createUser({ walletAddress: userWallet })

    // Enter referral code
    const result = await referralService.enterReferralCode(userWallet, referrer.referralCode!)

    expect(result.success).toBe(true)
    expect(result.message).toBe('Referral code applied successfully')

    // Verify relationship was created
    const userInfo = await referralService.getReferralInfo(userWallet)
    expect(userInfo!.referredBy).toBeDefined()
    expect(userInfo!.referredBy!.walletAddress).toBe(referrerWallet)

    // Verify referrer's list was updated
    const referrerInfo = await referralService.getReferralInfo(referrerWallet)
    expect(referrerInfo!.totalReferrals).toBe(1)
    expect(referrerInfo!.referredUsers[0]?.walletAddress).toBe(userWallet)
  })

  it('should prevent self-referral', async () => {
    // Create user
    const userWallet = randomAddress()
    const user = await userService.createUser({ walletAddress: userWallet })

    // Try to refer themselves
    const result = await referralService.enterReferralCode(userWallet, user.referralCode!)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Cannot refer yourself')
  })

  it('should prevent double referral', async () => {
    // Create referrer 1
    const referrer1Wallet = randomAddress()
    const referrer1 = await userService.createUser({ walletAddress: referrer1Wallet })

    // Create referrer 2
    const referrer2Wallet = randomAddress()  
    const referrer2 = await userService.createUser({ walletAddress: referrer2Wallet })

    // Create user
    const userWallet = randomAddress()
    await userService.createUser({ walletAddress: userWallet })

    // First referral
    const result1 = await referralService.enterReferralCode(userWallet, referrer1.referralCode!)
    expect(result1.success).toBe(true)

    // Try second referral (should fail)
    const result2 = await referralService.enterReferralCode(userWallet, referrer2.referralCode!)
    expect(result2.success).toBe(false)
    expect(result2.message).toBe('User is already referred')
  })
}) 
