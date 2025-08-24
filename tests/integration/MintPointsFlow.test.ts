import { ObjectId } from "mongodb"
import { MongoMemoryServer } from "mongodb-memory-server"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { DB_NAME } from "../../src/config/env.js"
import { database } from '../../src/database/database.js'
import { PointsService } from "../../src/services/PointsService.js"
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

describe('Complete Mint Points Flow Integration', () => {
  const pointsService = new PointsService()
  const userService = new UserService()

  it('should handle complete mint flow: Bob refers Alice, both get appropriate points', async () => {
    // === SETUP ===
    // Create Bob (referrer)
    const bobWallet = randomAddress()
    const bob = await userService.createUser({ walletAddress: bobWallet })

    // Create Alice (referred user)
    const aliceWallet = randomAddress()
    const alice = await userService.createUser({ walletAddress: aliceWallet })

    // Set up referral: Alice was referred by Bob
    await database.getDb().collection('users').updateOne(
      { _id: alice._id },
      { $set: { referredBy: bob._id } }
    )

    // === BOB MINTS 1 TOKEN ===
    console.log('=== Bob mints 1 token ===')
    
    // Bob gets mint points (10 base points, Common tier = no bonus)
    const bobMintResult = await pointsService.awardMintPoints(bobWallet, 1)
    expect(bobMintResult.pointsAwarded).toBe(10) // 1 × 10 × 1.0 = 10
    expect(bobMintResult.tier).toBe('Common')
    expect(bobMintResult.bonus).toBe(1.0)

    // Bob has no referrer, so no referral points awarded to anyone
    const bobReferralResult = await pointsService.awardReferralPoints(
      bobWallet,
      1,
      new ObjectId()
    )
    expect(bobReferralResult.awarded).toBe(false)

    // Check Bob's balance
    const bobPointsAfterMint = await pointsService.getPointsBalance(bobWallet)
    expect(bobPointsAfterMint).toBe(10)

    // === ALICE MINTS 1 TOKEN ===
    console.log('=== Alice mints 1 token ===')
    
    // Alice gets mint points (10 base points, Common tier = no bonus)
    const aliceMintResult = await pointsService.awardMintPoints(aliceWallet, 1)
    expect(aliceMintResult.pointsAwarded).toBe(10) // 1 × 10 × 1.0 = 10
    expect(aliceMintResult.tier).toBe('Common')
    expect(aliceMintResult.bonus).toBe(1.0)

    // Bob gets referral points (1 point, fixed)
    const aliceReferralResult = await pointsService.awardReferralPoints(
      aliceWallet,
      1,
      new ObjectId()
    )
    expect(aliceReferralResult.awarded).toBe(true)
    expect(aliceReferralResult.referrerWallet).toBe(bobWallet)
    expect(aliceReferralResult.pointsAwarded).toBe(1) // Fixed 1 point per mint

    // === FINAL BALANCES ===
    const finalBobPoints = await pointsService.getPointsBalance(bobWallet)
    const finalAlicePoints = await pointsService.getPointsBalance(aliceWallet)

    expect(finalBobPoints).toBe(11) // 10 (own mint) + 1 (referral from Alice)
    expect(finalAlicePoints).toBe(10) // 10 (own mint)

    // Check referral points tracking
    const finalBob = await pointsService.getUserByWallet(bobWallet)
    const finalAlice = await pointsService.getUserByWallet(aliceWallet)

    expect(finalBob?.pointsEarnedFromReferrals).toBe(1) // 1 from Alice's mint
    expect(finalAlice?.pointsEarnedFromReferrals).toBe(0) // Alice didn't refer anyone

    console.log(`Final: Bob has ${finalBobPoints} points (${finalBob?.pointsEarnedFromReferrals} from referrals), Alice has ${finalAlicePoints} points`)
  })

  it('should handle tier progression: user with referrals gets bonus on own mints', async () => {
    // === SETUP ===
    // Create Charlie (will become high tier)
    const charlieWallet = randomAddress()
    const charlie = await userService.createUser({ walletAddress: charlieWallet })

    // Create David (referred by Charlie)
    const davidWallet = randomAddress()
    const david = await userService.createUser({ walletAddress: davidWallet })

    // Set up referral
    await database.getDb().collection('users').updateOne(
      { _id: david._id },
      { $set: { referredBy: charlie._id } }
    )

    // === Give Charlie enough referral points to reach Uncommon tier ===
    // Manually set Charlie to have 1500 referral points (above 1000 threshold)
    await database.getDb().collection('users').updateOne(
      { _id: charlie._id },
      { $set: { 
        pointsEarnedFromReferrals: 1500,
        points: 1500 
      } }
    )

    // === DAVID MINTS 15 TOKENS (gives Charlie additional referral points) ===
    console.log('=== David mints 15 tokens ===')
    
    // David gets his mint points
    await pointsService.awardMintPoints(davidWallet, 15)
    
    // Charlie gets additional referral points (15 more points)
    const referralResult = await pointsService.awardReferralPoints(
      davidWallet,
      15,
      new ObjectId()
    )
    expect(referralResult.awarded).toBe(true)
    expect(referralResult.pointsAwarded).toBe(15)

    // Check Charlie now has 1515 referral points (still Uncommon tier)
    const charlieAfterReferrals = await pointsService.getUserByWallet(charlieWallet)
    expect(charlieAfterReferrals?.pointsEarnedFromReferrals).toBe(1515)

    // === CHARLIE MINTS 1 TOKEN (should get Uncommon tier bonus) ===
    console.log('=== Charlie mints 1 token with Uncommon tier bonus ===')
    
    const charlieMintResult = await pointsService.awardMintPoints(charlieWallet, 1)
    expect(charlieMintResult.pointsAwarded).toBe(12) // 1 × 10 × 1.2 = 12
    expect(charlieMintResult.tier).toBe('Uncommon')
    expect(charlieMintResult.bonus).toBe(1.2)

    // === FINAL BALANCES ===
    const finalCharliePoints = await pointsService.getPointsBalance(charlieWallet)
    const finalDavidPoints = await pointsService.getPointsBalance(davidWallet)

    expect(finalCharliePoints).toBe(1527) // 1500 (initial) + 15 (referrals) + 12 (own mint with bonus)
    expect(finalDavidPoints).toBe(150) // 15 × 10 (own mints, Common tier)

    console.log(`Final: Charlie has ${finalCharliePoints} points (with Uncommon tier bonus), David has ${finalDavidPoints} points`)
  })

  it('should handle multiple referrals and maintain fixed referral rates', async () => {
    // === SETUP ===
    // Create Eve (referrer, will reach high tier)
    const eveWallet = randomAddress()
    const eve = await userService.createUser({ walletAddress: eveWallet })

    // Create multiple referred users
    const referredUsers = []
    for (let i = 0; i < 3; i++) {
      const userWallet = randomAddress()
      const user = await userService.createUser({ walletAddress: userWallet })
      
      // Set up referral relationship
      await database.getDb().collection('users').updateOne(
        { _id: user._id },
        { $set: { referredBy: eve._id } }
      )
      
      referredUsers.push({ wallet: userWallet, user })
    }

    // === GIVE EVE HIGH TIER THROUGH MANUAL SETUP ===
    // Manually set Eve to Epic tier (20000+ referral points)
    await database.getDb().collection('users').updateOne(
      { _id: eve._id },
      { $set: { 
        pointsEarnedFromReferrals: 25000, // Epic tier (20000+ points)
        points: 25000 
      } }
    )

    // === EACH REFERRED USER MINTS 2 TOKENS ===
    
    for (const { wallet } of referredUsers) {
      console.log(`=== User ${wallet.slice(0, 8)}... mints 2 tokens ===`)
      
      // User gets their mint points
      await pointsService.awardMintPoints(wallet, 2)
      
      // Eve gets fixed referral points (2 points, no tier bonus)
      const referralResult = await pointsService.awardReferralPoints(
        wallet,
        2,
        new ObjectId()
      )
      expect(referralResult.awarded).toBe(true)
      expect(referralResult.pointsAwarded).toBe(2) // Always fixed 1 point per mint
    }

    // === EVE MINTS 1 TOKEN (should get Epic tier bonus) ===
    console.log('=== Eve mints 1 token with Epic tier bonus ===')
    
    const eveMintResult = await pointsService.awardMintPoints(eveWallet, 1)
    expect(eveMintResult.pointsAwarded).toBe(20) // 1 × 10 × 2.0 = 20 (Epic tier bonus)
    expect(eveMintResult.tier).toBe('Epic')
    expect(eveMintResult.bonus).toBe(2.0)

    // === FINAL CHECKS ===
    const finalEvePoints = await pointsService.getPointsBalance(eveWallet)
    expect(finalEvePoints).toBe(25026) // 25000 (initial) + 6 (referrals: 3×2) + 20 (own mint with Epic bonus)

    const finalEve = await pointsService.getUserByWallet(eveWallet)
    expect(finalEve?.pointsEarnedFromReferrals).toBe(25006) // 25000 (initial) + 6 (from referrals)

    console.log(`Final: Eve has ${finalEvePoints} total points (${finalEve?.pointsEarnedFromReferrals} from referrals) with Epic tier`)
  })

  it('should maintain consistency with case-insensitive addresses', async () => {
    // Create users with mixed case addresses
    const referrerWallet = randomAddress().toUpperCase()
    const referrer = await userService.createUser({ walletAddress: referrerWallet })

    const minterWallet = randomAddress().toLowerCase()
    const minter = await userService.createUser({ walletAddress: minterWallet })

    // Set up referral
    await database.getDb().collection('users').updateOne(
      { _id: minter._id },
      { $set: { referredBy: referrer._id } }
    )

    // Test with mixed case in service calls
    await pointsService.awardMintPoints(minterWallet.toUpperCase(), 2)
    const referralResult = await pointsService.awardReferralPoints(
      minterWallet.toLowerCase(),
      2,
      new ObjectId()
    )

    expect(referralResult.awarded).toBe(true)
    expect(referralResult.pointsAwarded).toBe(2)

    // Check balances with different cases
    const minterPoints1 = await pointsService.getPointsBalance(minterWallet.toLowerCase())
    const minterPoints2 = await pointsService.getPointsBalance(minterWallet.toUpperCase())
    const referrerPoints1 = await pointsService.getPointsBalance(referrerWallet.toLowerCase())
    const referrerPoints2 = await pointsService.getPointsBalance(referrerWallet.toUpperCase())

    expect(minterPoints1).toBe(20) // 2 × 10
    expect(minterPoints2).toBe(20)
    expect(referrerPoints1).toBe(2) // 2 × 1 fixed referral points
    expect(referrerPoints2).toBe(2)
  })
}) 
