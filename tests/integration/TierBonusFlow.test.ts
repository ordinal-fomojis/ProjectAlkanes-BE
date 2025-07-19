import { ObjectId } from "mongodb"
import { MongoMemoryServer } from "mongodb-memory-server"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { DB_NAME } from "../../src/config/constants.js"
import { database } from "../../src/config/database.js"
import { PointsService } from "../../src/services/PointsService.js"
import { ReferralService } from "../../src/services/referralService.js"
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

describe('Tier Bonus System Integration', () => {
  const userService = new UserService()
  const referralService = new ReferralService()
  const pointsService = new PointsService()

  it('should award points with correct tier bonuses as user progresses', async () => {
    // Create referrer
    const referrerWallet = randomAddress()
    const referrer = await userService.createUser({ walletAddress: referrerWallet })

    // Create trader
    const traderWallet = randomAddress()
    const trader = await userService.createUser({ walletAddress: traderWallet })

    // Set up referral relationship
    await referralService.enterReferralCode(traderWallet, referrer.referralCode!)

    // Test 1: Common tier (0 points) - should get 1x bonus
    console.log('\n--- Testing Common Tier (0 points) ---')
    let result = await pointsService.awardReferralPoints(traderWallet, 10, new ObjectId())
    expect(result.awarded).toBe(true)
    expect(result.tier).toBe('Common')
    expect(result.bonus).toBe(1.0)
    expect(result.basePoints).toBe(10)
    expect(result.pointsAwarded).toBe(10) // 10 * 1.0 = 10

    // Verify referrer's points
    let referrerInfo = await referralService.getReferralInfo(referrerWallet)
    expect(referrerInfo!.pointsEarnedFromReferrals).toBe(10)
    expect(referrerInfo!.tier.level).toBe('Common')
    expect(referrerInfo!.tier.bonus).toBe(1.0)
    expect(referrerInfo!.nextTier!.level).toBe('Uncommon')
    expect(referrerInfo!.pointsToNextTier).toBe(990) // 1000 - 10 = 990

    // Manually set referrer to have 999 points (just below Uncommon threshold)
    await database.getDb().collection('users').updateOne(
      { _id: referrer._id },
      { $set: { points: 999, pointsEarnedFromReferrals: 999 } }
    )

    // Test 2: Still Common tier (999 points) - should get 1x bonus
    console.log('\n--- Testing Common Tier (999 points) ---')
    result = await pointsService.awardReferralPoints(traderWallet, 5, new ObjectId())
    expect(result.awarded).toBe(true)
    expect(result.tier).toBe('Common')
    expect(result.bonus).toBe(1.0)
    expect(result.pointsAwarded).toBe(5) // 5 * 1.0 = 5

    // Now should have 1004 points total, which puts them in Uncommon tier
    referrerInfo = await referralService.getReferralInfo(referrerWallet)
    expect(referrerInfo!.pointsEarnedFromReferrals).toBe(1004) // 999 + 5
    expect(referrerInfo!.tier.level).toBe('Uncommon') // Crossed threshold!
    expect(referrerInfo!.tier.bonus).toBe(1.2)

    // Test 3: Uncommon tier (1004 points) - should get 1.2x bonus
    console.log('\n--- Testing Uncommon Tier (1004 points) ---')
    result = await pointsService.awardReferralPoints(traderWallet, 10, new ObjectId())
    expect(result.awarded).toBe(true)
    expect(result.tier).toBe('Uncommon')
    expect(result.bonus).toBe(1.2)
    expect(result.pointsAwarded).toBe(12) // 10 * 1.2 = 12

    // Manually set referrer to Rare tier threshold
    await database.getDb().collection('users').updateOne(
      { _id: referrer._id },
      { $set: { points: 5000, pointsEarnedFromReferrals: 5000 } }
    )

    // Test 4: Rare tier (5000 points) - should get 1.5x bonus
    console.log('\n--- Testing Rare Tier (5000 points) ---')
    result = await pointsService.awardReferralPoints(traderWallet, 8, new ObjectId())
    expect(result.awarded).toBe(true)
    expect(result.tier).toBe('Rare')
    expect(result.bonus).toBe(1.5)
    expect(result.pointsAwarded).toBe(12) // 8 * 1.5 = 12

    // Manually set referrer to Epic tier threshold
    await database.getDb().collection('users').updateOne(
      { _id: referrer._id },
      { $set: { points: 20000, pointsEarnedFromReferrals: 20000 } }
    )

    // Test 5: Epic tier (20000 points) - should get 2x bonus
    console.log('\n--- Testing Epic Tier (20000 points) ---')
    result = await pointsService.awardReferralPoints(traderWallet, 7, new ObjectId())
    expect(result.awarded).toBe(true)
    expect(result.tier).toBe('Epic')
    expect(result.bonus).toBe(2.0)
    expect(result.pointsAwarded).toBe(14) // 7 * 2.0 = 14

    // Manually set referrer to Legendary tier threshold
    await database.getDb().collection('users').updateOne(
      { _id: referrer._id },
      { $set: { points: 50000, pointsEarnedFromReferrals: 50000 } }
    )

    // Test 6: Legendary tier (50000 points) - should get 2.5x bonus
    console.log('\n--- Testing Legendary Tier (50000 points) ---')
    result = await pointsService.awardReferralPoints(traderWallet, 6, new ObjectId())
    expect(result.awarded).toBe(true)
    expect(result.tier).toBe('Legendary')
    expect(result.bonus).toBe(2.5)
    expect(result.pointsAwarded).toBe(15) // 6 * 2.5 = 15

    // Final verification
    referrerInfo = await referralService.getReferralInfo(referrerWallet)
    expect(referrerInfo!.tier.level).toBe('Legendary')
    expect(referrerInfo!.nextTier).toBeUndefined() // No tier above Legendary
    expect(referrerInfo!.pointsToNextTier).toBeUndefined()

    console.log('\n🎉 Tier progression test completed successfully!')
    console.log(`Final referrer tier: ${referrerInfo!.tier.level} (${referrerInfo!.tier.bonus}x bonus)`)
    console.log(`Total referral points: ${referrerInfo!.pointsEarnedFromReferrals}`)
  })

  it('should handle fractional bonus points correctly', async () => {
    // Create referrer at Uncommon tier (1.2x bonus)
    const referrerWallet = randomAddress()
    const referrer = await userService.createUser({ walletAddress: referrerWallet })
    
    // Create trader
    const traderWallet = randomAddress()
    await userService.createUser({ walletAddress: traderWallet })
    
    // Set up referral relationship
    await referralService.enterReferralCode(traderWallet, referrer.referralCode!)
    
    // Set referrer to Uncommon tier
    await database.getDb().collection('users').updateOne(
      { _id: referrer._id },
      { $set: { points: 1500, pointsEarnedFromReferrals: 1500 } }
    )

    // Test fractional points (should floor)
    const result = await pointsService.awardReferralPoints(traderWallet, 3, new ObjectId())
    expect(result.tier).toBe('Uncommon')
    expect(result.bonus).toBe(1.2)
    expect(result.pointsAwarded).toBe(3) // 3 * 1.2 = 3.6 -> floor(3.6) = 3

    console.log('✓ Fractional bonus points handled correctly (floored)')
  })

  it('should show tier progression in API responses', async () => {
    // Create referrer starting at Common tier
    const referrerWallet = randomAddress()
    const referrer = await userService.createUser({ walletAddress: referrerWallet })

    // Initial tier should be Common
    let tierInfo = await referralService.getReferralInfo(referrerWallet)
    expect(tierInfo!.tier.level).toBe('Common')
    expect(tierInfo!.nextTier!.level).toBe('Uncommon')
    expect(tierInfo!.pointsToNextTier).toBe(1000)

    // Manually advance to Uncommon tier
    await database.getDb().collection('users').updateOne(
      { _id: referrer._id },
      { $set: { points: 2500, pointsEarnedFromReferrals: 2500 } }
    )

    tierInfo = await referralService.getReferralInfo(referrerWallet)
    expect(tierInfo!.tier.level).toBe('Uncommon')
    expect(tierInfo!.tier.bonus).toBe(1.2)
    expect(tierInfo!.nextTier!.level).toBe('Rare')
    expect(tierInfo!.pointsToNextTier).toBe(2500) // 5000 - 2500 = 2500

    console.log('✓ Tier progression visible in API responses')
  })
}) 
