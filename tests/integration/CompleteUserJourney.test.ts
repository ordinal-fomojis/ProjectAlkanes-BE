import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { DB_NAME } from '../../src/config/env.js'
import { database } from '../../src/database/database.js'
import { PointsService } from '../../src/services/PointsService.js'
import { ReferralService } from '../../src/services/referralService.js'
import { UserService } from '../../src/services/userService.js'
import { randomAddress } from '../test-utils/btc-random.js'

let mongodb: MongoMemoryServer

describe('Complete User Journey: From Sign-up to Legendary', () => {
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
    await database.getDb().collection('users').deleteMany({})
  })

  it('should complete full user lifecycle with referral system', async () => {
    console.log('🚀 Starting Complete User Journey Test')

    // === PHASE 1: BOOTSTRAP USER (Alice) ===
    console.log('\n📍 Phase 1: Bootstrap User Setup')
    
    const aliceWallet = randomAddress()
    console.log(`Alice wallet: ${aliceWallet.substring(0, 10)}...`)
    
    // Alice creates account
    const alice = await userService.createUser({ walletAddress: aliceWallet })
    expect(alice.walletAddress).toBe(aliceWallet.toLowerCase())
    
    // Alice starts unreferred - no referral code visible
    let aliceInfo = await referralService.getReferralInfo(aliceWallet)
    expect(aliceInfo?.referralCode).toBeUndefined()
         expect(aliceInfo?.referredBy).toBeUndefined()
    console.log('✓ Alice created - no referral code visible yet')
    
    // Alice uses bootstrap code
    const bootstrapResult = await referralService.enterReferralCode(aliceWallet, 'BOOTSTRAP')
    expect(bootstrapResult.success).toBe(true)
    console.log('✓ Alice used BOOTSTRAP code')
    
    // Alice can now see her referral code
    aliceInfo = await referralService.getReferralInfo(aliceWallet)
    expect(aliceInfo?.referralCode).toBeDefined()
    expect(aliceInfo?.referredBy).toBeDefined()
    const aliceReferralCode = aliceInfo!.referralCode!
    console.log(`✓ Alice can now see referral code: ${aliceReferralCode}`)

    // === PHASE 2: ALICE MINTS AND BUILDS TIER ===
    console.log('\n📍 Phase 2: Alice Mints and Progresses')
    
    // Alice mints tokens (gets mint points)
    await pointsService.awardMintPoints(aliceWallet, 1000, 10) // 1000 mints * 10 = 10000 points
    aliceInfo = await referralService.getReferralInfo(aliceWallet)
    expect(aliceInfo?.points).toBe(10000)
    expect(aliceInfo?.tier.level).toBe('Uncommon') // 10000 points = Uncommon
    console.log(`✓ Alice minted 1000 tokens, reached ${aliceInfo?.tier.level} tier (${aliceInfo?.points} points)`)

    // === PHASE 3: ALICE REFERS BOB ===
    console.log('\n📍 Phase 3: Alice Refers Bob')
    
    const bobWallet = randomAddress()
    console.log(`Bob wallet: ${bobWallet.substring(0, 10)}...`)
    
    // Bob creates account
    await userService.createUser({ walletAddress: bobWallet })
    
    // Bob starts with no referral code visible
    let bobInfo = await referralService.getReferralInfo(bobWallet)
    expect(bobInfo?.referralCode).toBeUndefined()
    console.log('✓ Bob created - no referral code visible')
    
    // Bob enters Alice's referral code
    const referralResult = await referralService.enterReferralCode(bobWallet, aliceReferralCode)
    expect(referralResult.success).toBe(true)
    console.log('✓ Bob entered Alice\'s referral code')
    
    // Bob can now see his referral code
    bobInfo = await referralService.getReferralInfo(bobWallet)
    expect(bobInfo?.referralCode).toBeDefined()
    expect(bobInfo?.referredBy?.walletAddress).toBe(aliceWallet)
    console.log(`✓ Bob can now see his referral code: ${bobInfo?.referralCode}`)
    
    // Alice should see Bob in her referred users
    aliceInfo = await referralService.getReferralInfo(aliceWallet)
    expect(aliceInfo?.totalReferrals).toBe(1)
    expect(aliceInfo?.referredUsers[0]?.walletAddress).toBe(bobWallet)
    console.log('✓ Alice sees Bob as referred user')

    // === PHASE 4: BOB MINTS (GIVES ALICE REFERRAL POINTS) ===
    console.log('\n📍 Phase 4: Bob Mints, Alice Gets Referral Points')
    
    // Bob mints 50 tokens
    await pointsService.awardMintPoints(bobWallet, 50, 10) // Bob gets 500 points
    const bobReferralResult = await pointsService.awardReferralPoints(bobWallet, 50, new ObjectId())
    
    expect(bobReferralResult.awarded).toBe(true)
    expect(bobReferralResult.referrerWallet).toBe(aliceWallet)
    expect(bobReferralResult.pointsAwarded).toBe(50) // Alice gets 50 referral points
    console.log('✓ Bob minted 50 tokens, Alice received 50 referral points')
    
    // Check updated points
    bobInfo = await referralService.getReferralInfo(bobWallet)
    expect(bobInfo?.points).toBe(500) // Bob's mint points
    expect(bobInfo?.tier.level).toBe('Common') // Still Common tier
    
    aliceInfo = await referralService.getReferralInfo(aliceWallet)
    expect(aliceInfo?.points).toBe(10050) // 10000 mint + 50 referral
    expect(aliceInfo?.pointsEarnedFromReferrals).toBe(50)
    expect(aliceInfo?.tier.level).toBe('Uncommon') // Still Uncommon
    console.log(`✓ Alice: ${aliceInfo?.points} total points (${aliceInfo?.pointsEarnedFromReferrals} from referrals)`)

    // === PHASE 5: SCALE UP - ALICE REFERS MANY USERS ===
    console.log('\n📍 Phase 5: Alice Builds Referral Network')
    
    const referredUsers = []
    
    // Alice refers 40 more users
    for (let i = 0; i < 40; i++) {
      const userWallet = randomAddress()
      await userService.createUser({ walletAddress: userWallet })
      await referralService.enterReferralCode(userWallet, aliceReferralCode)
      referredUsers.push(userWallet)
    }
    
    // Each user mints 25 tokens (40 * 25 = 1000 more referral points for Alice)
    for (const userWallet of referredUsers) {
      await pointsService.awardMintPoints(userWallet, 25, 10)
      await pointsService.awardReferralPoints(userWallet, 25, new ObjectId())
    }
    
    aliceInfo = await referralService.getReferralInfo(aliceWallet)
    expect(aliceInfo?.totalReferrals).toBe(41) // Bob + 40 others
    expect(aliceInfo?.points).toBe(11050) // 10000 mint + 1050 referral (50 + 1000)
    expect(aliceInfo?.pointsEarnedFromReferrals).toBe(1050)
    expect(aliceInfo?.tier.level).toBe('Uncommon') // Still Uncommon (need 50000 for Rare)
    console.log(`✓ Alice has ${aliceInfo?.totalReferrals} referrals, ${aliceInfo?.points} total points`)

    // === PHASE 6: ALICE REACHES RARE TIER ===
    console.log('\n📍 Phase 6: Alice Reaches Rare Tier')
    
    // Alice mints more tokens to reach Rare tier
    await pointsService.awardMintPoints(aliceWallet, 3620, 10) // 3620 * 10 = 36200 more points
    
    aliceInfo = await referralService.getReferralInfo(aliceWallet)
         expect(aliceInfo?.points).toBe(54490) // 11050 + 43440 (36200 × 1.2 Uncommon bonus)
    expect(aliceInfo?.tier.level).toBe('Rare')
    expect(aliceInfo?.tier.bonus).toBe(1.5)
    expect(aliceInfo?.nextTier?.level).toBe('Epic')
         expect(aliceInfo?.pointsToNextTier).toBe(145510) // 200000 - 54490
    console.log(`✓ Alice reached ${aliceInfo?.tier.level} tier! Next: ${aliceInfo?.nextTier?.level} (need ${aliceInfo?.pointsToNextTier} more points)`)

    // === PHASE 7: ALICE GETS TIER BONUS ===
    console.log('\n📍 Phase 7: Alice Gets Tier Bonus on New Mints')
    
    // Alice mints 10 more tokens with Rare tier bonus
    const aliceBonusMint = await pointsService.awardMintPoints(aliceWallet, 10, 10)
    expect(aliceBonusMint.pointsAwarded).toBe(150) // 10 * 10 * 1.5 = 150
    expect(aliceBonusMint.tier).toBe('Rare')
    expect(aliceBonusMint.bonus).toBe(1.5)
    console.log(`✓ Alice minted 10 tokens with Rare bonus: ${aliceBonusMint.pointsAwarded} points`)
    
    aliceInfo = await referralService.getReferralInfo(aliceWallet)
         expect(aliceInfo?.points).toBe(54640) // 54490 + 150
    console.log(`✓ Alice final stats: ${aliceInfo?.points} points, ${aliceInfo?.tier.level} tier, ${aliceInfo?.totalReferrals} referrals`)

    // === PHASE 8: BOB CREATES CUSTOM REFERRAL LINK ===
    console.log('\n📍 Phase 8: Bob Creates Custom Referral Link')
    
    // Bob creates custom referral link (he's referred so this should work)
    const customLinkResult = await referralService.createCustomReferralLink(bobWallet, 'bob-cool-link')
    expect(customLinkResult.success).toBe(true)
    console.log('✓ Bob created custom referral link: bob-cool-link')
    
    bobInfo = await referralService.getReferralInfo(bobWallet)
    expect(bobInfo?.customReferralId).toBe('bob-cool-link')
    
    // === PHASE 9: SOMEONE USES BOB'S CUSTOM LINK ===
    console.log('\n📍 Phase 9: Charlie Uses Bob\'s Custom Link')
    
    const charlieWallet = randomAddress()
    await userService.createUser({ walletAddress: charlieWallet })
    
    // Charlie uses Bob's custom link
    const customReferralResult = await referralService.enterReferralCode(charlieWallet, 'bob-cool-link')
    expect(customReferralResult.success).toBe(true)
    console.log('✓ Charlie used Bob\'s custom link')
    
    const charlieInfo = await referralService.getReferralInfo(charlieWallet)
    expect(charlieInfo?.referredBy?.walletAddress).toBe(bobWallet)
    
    bobInfo = await referralService.getReferralInfo(bobWallet)
    expect(bobInfo?.totalReferrals).toBe(1)
    console.log('✓ Bob now has 1 referral through his custom link')

    // === FINAL VERIFICATION ===
    console.log('\n📍 Final Verification')
    
    // Alice: High-tier user with many referrals
    aliceInfo = await referralService.getReferralInfo(aliceWallet)
    expect(aliceInfo?.tier.level).toBe('Rare')
    expect(aliceInfo?.totalReferrals).toBe(41)
    expect(aliceInfo?.points).toBeGreaterThan(50000)
    
    // Bob: Mid-tier user who refers others
    bobInfo = await referralService.getReferralInfo(bobWallet)
    expect(bobInfo?.referralCode).toBeDefined()
    expect(bobInfo?.customReferralId).toBe('bob-cool-link')
    expect(bobInfo?.totalReferrals).toBe(1)
    
    // Charlie: New referred user
    expect(charlieInfo?.referredBy?.walletAddress).toBe(bobWallet)
    expect(charlieInfo?.referralCode).toBeDefined() // Can see code since referred
    
    console.log('\n🎉 Complete User Journey Test Passed!')
    console.log(`   Alice: ${aliceInfo?.tier.level} tier, ${aliceInfo?.totalReferrals} referrals, ${aliceInfo?.points} points`)
    console.log(`   Bob: ${bobInfo?.tier.level} tier, ${bobInfo?.totalReferrals} referrals, ${bobInfo?.points} points`)
    console.log(`   Charlie: ${charlieInfo?.tier.level} tier, referred by Bob, ${charlieInfo?.points} points`)
  })

  it('should handle unreferred user attempting restricted actions', async () => {
    console.log('\n🚫 Testing Unreferred User Restrictions')
    
    const unrefUserWallet = randomAddress()
    await userService.createUser({ walletAddress: unrefUserWallet })
    
    // User should not see referral code
    const userInfo = await referralService.getReferralInfo(unrefUserWallet)
    expect(userInfo?.referralCode).toBeUndefined()
    expect(userInfo?.customReferralId).toBeUndefined()
    console.log('✓ Unreferred user cannot see referral codes')
    
    // User should not be able to create custom links (via gate check)
    const { requireReferralForReferralAction } = await import('../../src/middleware/referralGate.js')
    const gateResult = await requireReferralForReferralAction(unrefUserWallet)
    expect(gateResult.allowed).toBe(false)
    console.log('✓ Unreferred user blocked from creating custom links')
    
    // User should not get referral points for minting (no referrer)
    const mintResult = await pointsService.awardReferralPoints(unrefUserWallet, 10, new ObjectId())
    expect(mintResult.awarded).toBe(false)
    console.log('✓ Unreferred user minting does not award referral points')
    
    console.log('✅ All restrictions working correctly')
  })
}) 
