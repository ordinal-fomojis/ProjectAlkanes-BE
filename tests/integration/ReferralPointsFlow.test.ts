import { ObjectId } from "mongodb"
import { MongoMemoryServer } from "mongodb-memory-server"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { DB_NAME } from "../../src/config/env-vars.js"
import { database } from '../../src/database/database.js'
import { MintTransactionService } from "../../src/services/MintTransactionService.js"
import { PointsService } from "../../src/services/PointsService.js"
import { ReferralService } from "../../src/services/referralService.js"
import { UserService } from "../../src/services/userService.js"
import { randomAddress } from "../test-utils/btc-random.js"
import Random from "../test-utils/Random.js"

let mongodb: MongoMemoryServer
beforeAll(async () => {
  mongodb = await MongoMemoryServer.create()
  await database.connect(mongodb.getUri(), DB_NAME())
})

afterAll(async () => {
  await database.disconnect()
  await mongodb.stop()
})

describe('Referral Points Integration Flow', () => {
  const userService = new UserService()
  const referralService = new ReferralService()
  const pointsService = new PointsService()
  const mintService = new MintTransactionService()

  it('should award points through complete referral and mint flow', async () => {
    // 1. Create Referrer User
    const referrerWallet = randomAddress()
    const referrer = await userService.createUser({ walletAddress: referrerWallet })
    console.log('✓ Created referrer with code:', referrer.referralCode)

    // 2. Create Trader User  
    const traderWallet = randomAddress()
    await userService.createUser({ walletAddress: traderWallet })
    console.log('✓ Created trader')

    // 3. Trader enters referral code
    const referralResult = await referralService.enterReferralCode(traderWallet, referrer.referralCode!)
    expect(referralResult.success).toBe(true)
    console.log('✓ Trader entered referral code successfully')

    // 4. Verify referral relationship
    const traderInfo = await referralService.getReferralInfo(traderWallet)
    expect(traderInfo?.referredBy?.walletAddress).toBe(referrerWallet)
    console.log('✓ Referral relationship verified')

    // 5. Simulate trader creating a mint transaction (5 tokens)
    const mintTx: Parameters<typeof mintService.createMintTransaction>[0] = {
      encryptedWif: {
        iv: Random.randomHex(16),
        data: Random.randomHex(64)
      },
      serviceFee: 100,
      networkFee: 50,
      paddingCost: 10,
      totalCost: 160,
      tokenId: '2:0',
      type: 'alkane',
      mintCount: 5,
      paymentAddress: traderWallet,
      receiveAddress: randomAddress(),
      paymentTxid: Random.randomTransactionId(),
      txids: Array.from({ length: 5 }, () => Random.randomTransactionId()),
      requestId: crypto.randomUUID()
    }
    const mintId = await mintService.createMintTransaction(mintTx)
    console.log('✓ Created mint transaction for 5 tokens')

    // 6. Award points (this happens in the GET /transactions route)
    const pointsResult = await pointsService.awardReferralPoints(
      traderWallet,
      mintTx.mintCount,
      new ObjectId(mintId)
    )

    expect(pointsResult.awarded).toBe(true)
    expect(pointsResult.referrerWallet).toBe(referrerWallet)
    expect(pointsResult.pointsAwarded).toBe(5)
    console.log('✓ Points awarded successfully:', pointsResult.pointsAwarded)

    // 7. Check referrer's points balance
    const referrerPoints = await pointsService.getPointsBalance(referrerWallet)
    expect(referrerPoints).toBe(5)
    console.log('✓ Referrer points balance verified:', referrerPoints)

    // 8. Check referral info shows cached points  
    const referrerInfo = await referralService.getReferralInfo(referrerWallet)
    expect(referrerInfo?.points).toBe(5) // Total points
    expect(referrerInfo?.pointsEarnedFromReferrals).toBe(5) // Points from referrals
    expect(referrerInfo?.totalReferrals).toBe(1) // 1 referred user
    console.log('✓ Referral info shows correct cached points')

    // 9. Trader mints again (3 more tokens) - points should accumulate
    const mintTx2 = { ...mintTx, mintCount: 3, mintsInEachOutput: [3] }
    const mintId2 = await mintService.createMintTransaction(mintTx2)
    
    await pointsService.awardReferralPoints(traderWallet, 3, new ObjectId(mintId2))
    console.log('✓ Second mint completed (3 tokens)')

    // 10. Verify accumulated points
    const finalReferrerPoints = await pointsService.getPointsBalance(referrerWallet)
    expect(finalReferrerPoints).toBe(8) // 5 + 3
    
    const finalReferrerInfo = await referralService.getReferralInfo(referrerWallet)
    expect(finalReferrerInfo?.points).toBe(8)
    expect(finalReferrerInfo?.pointsEarnedFromReferrals).toBe(8)
    console.log('✓ Points accumulated correctly:', finalReferrerPoints)

    console.log('\n🎉 Complete referral points flow test passed!')
    console.log(`Referrer ${referrerWallet.slice(0, 10)}... earned ${finalReferrerPoints} points`)
    console.log(`From trader ${traderWallet.slice(0, 10)}... minting ${mintTx.mintCount + (mintTx2.mintCount || 0)} total tokens`)
  })

  it('should handle multiple referred traders', async () => {
    // Create referrer
    const referrerWallet = randomAddress()
    const referrer = await userService.createUser({ walletAddress: referrerWallet })

    // Create 3 traders
    const traders = await Promise.all([
      userService.createUser({ walletAddress: randomAddress() }),
      userService.createUser({ walletAddress: randomAddress() }),
      userService.createUser({ walletAddress: randomAddress() })
    ])

    // All traders use referral code
    for (const trader of traders) {
      await referralService.enterReferralCode(trader.walletAddress, referrer.referralCode!)
    }

    // Each trader mints different amounts
    const mintCounts = [2, 4, 6]
    for (let i = 0; i < traders.length; i++) {
      const trader = traders[i]!
      const mintCount = mintCounts[i]!
      await pointsService.awardReferralPoints(
        trader.walletAddress,
        mintCount,
        new ObjectId()
      )
    }

    // Check total points (2 + 4 + 6 = 12)
    const totalPoints = await pointsService.getPointsBalance(referrerWallet)
    expect(totalPoints).toBe(12)

    const referrerInfo = await referralService.getReferralInfo(referrerWallet)
    expect(referrerInfo?.totalReferrals).toBe(3)
    expect(referrerInfo?.pointsEarnedFromReferrals).toBe(12)

    console.log('✓ Multiple traders test passed - 3 traders generated 12 points total')
  })

  it('should not award points to non-referred traders', async () => {
    // Create trader without referrer
    const soloTraderWallet = randomAddress()
    await userService.createUser({ walletAddress: soloTraderWallet })

    // Try to award points
    const result = await pointsService.awardReferralPoints(soloTraderWallet, 10, new ObjectId())
    
    expect(result.awarded).toBe(false)
    expect(result.referrerWallet).toBeUndefined()

    console.log('✓ Non-referred trader correctly received no points')
  })
}) 
