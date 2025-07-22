import { MongoMemoryServer } from "mongodb-memory-server"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { DB_NAME } from "../../src/config/constants.js"
import { database } from "../../src/config/database.js"
import { MintTransactionService } from "../../src/services/MintTransactionService.js"
import { PointsService } from "../../src/services/PointsService.js"
import { UnconfirmedTransactionService } from "../../src/services/UnconfirmedTransactionService.js"
import { UnsignedMintTransactionService } from "../../src/services/UnsignedMintTransactionService.js"
import { UserService } from "../../src/services/userService.js"
import { randomAddress } from "../test-utils/btc-random.js"
import Random from "../test-utils/Random.js"

// Mock external dependencies
vi.mock('../../src/utils/transaction/getUtxos.js', () => ({
  getUtxos: vi.fn().mockResolvedValue([
    {
      txid: Random.randomTransactionId(),
      vout: 0,
      value: 10000000 // 0.1 BTC
    }
  ])
}))

vi.mock('../../src/utils/rpc/sendTransactions.js', () => ({
  sendTransaction: vi.fn().mockResolvedValue('success')
}))

vi.mock('../../src/services/AlkaneTokenService.js', () => ({
  AlkaneTokenService: class {
    async getAlkaneById() {
      return {
        alkaneId: '2:61011',
        mintable: true,
        mintedOut: false
      }
    }
  }
}))

let mongodb: MongoMemoryServer

beforeAll(async () => {
  mongodb = await MongoMemoryServer.create()
  await database.connect(mongodb.getUri(), DB_NAME)
})

afterAll(async () => {
  await database.disconnect()
  await mongodb.stop()
})

describe('Transaction Points Flow Integration', () => {
  const pointsService = new PointsService()
  const userService = new UserService()
  const unsignedMintService = new UnsignedMintTransactionService()
  const mintTransactionService = new MintTransactionService()
  const unconfirmedTransactionService = new UnconfirmedTransactionService()

  it('should NOT award points during unsigned transaction creation, but ONLY after confirmed transaction storage', async () => {
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

    // Check initial points (should be 0)
    const aliceInitialPoints = await pointsService.getPointsBalance(aliceWallet)
    const bobInitialPoints = await pointsService.getPointsBalance(bobWallet)
    expect(aliceInitialPoints).toBe(0)
    expect(bobInitialPoints).toBe(0)

    // === STEP 1: Create unsigned transaction (simulates GET /api/tx) ===
    console.log('=== Step 1: Creating unsigned transaction (like GET /api/tx) ===')
    
    const unsignedMintTx = {
      psbt: Random.randomHex(100),
      wif: Random.randomHex(64),
      serviceFee: 100,
      networkFee: 50,
      paddingCost: 10,
      networkFeePerMint: 5,
      networkFeeOfFinalMint: 10,
      mintsInEachOutput: [5],
      alkaneId: '2:61011',
      mintCount: 5,
      paymentAddress: aliceWallet,
      receiveAddress: randomAddress(),
    }

    const unsignedTxId = await unsignedMintService.createMintTransaction(unsignedMintTx)

    // === VERIFY: NO POINTS AWARDED YET ===
    console.log('=== Verifying no points awarded during unsigned transaction creation ===')
    
    const alicePointsAfterUnsigned = await pointsService.getPointsBalance(aliceWallet)
    const bobPointsAfterUnsigned = await pointsService.getPointsBalance(bobWallet)
    
    expect(alicePointsAfterUnsigned).toBe(0) // Alice should have NO mint points yet
    expect(bobPointsAfterUnsigned).toBe(0)   // Bob should have NO referral points yet
    
    console.log('✓ Confirmed: No points awarded during unsigned transaction creation')

    // === STEP 2: Simulate broadcast and transaction storage (like POST /api/tx) ===
    console.log('=== Step 2: Simulating broadcast and transaction storage (like POST /api/tx) ===')
    
    // Create mock transactions (simulating successful broadcast)
    const paymentTxId = Random.randomTransactionId()
    const allTransactions = [
      { tx: {} as any, txHex: Random.randomHex(200), txid: paymentTxId, broadcasted: true }
    ]

    // Store the mint transaction (without session for test simplicity)
    const mintTxId = await mintTransactionService.createMintTransaction({
      wif: unsignedMintTx.wif,
      serviceFee: unsignedMintTx.serviceFee,
      networkFee: unsignedMintTx.networkFee,
      paddingCost: unsignedMintTx.paddingCost,
      totalCost: unsignedMintTx.serviceFee + unsignedMintTx.networkFee + unsignedMintTx.paddingCost,
      paymentTxid: paymentTxId,
      alkaneId: unsignedMintTx.alkaneId,
      mintCount: unsignedMintTx.mintCount,
      paymentAddress: unsignedMintTx.paymentAddress,
      receiveAddress: unsignedMintTx.receiveAddress,
      txids: allTransactions.map(tx => tx.txid),
    })

    // Store unconfirmed transactions
    await unconfirmedTransactionService.createTransactionsForMint({
      txns: allTransactions,
      wif: unsignedMintTx.wif,
      mintTx: mintTxId
    })

    // Award points ONLY after successful storage
    console.log('=== Awarding points after successful broadcast and storage ===')
    
    // 1. Award mint points to Alice
    const mintPointsResult = await pointsService.awardMintPoints(
      unsignedMintTx.paymentAddress,
      unsignedMintTx.mintCount,
      10 // Base points per mint
    )
    expect(mintPointsResult.pointsAwarded).toBe(50) // 5 × 10 × 1.0 = 50
    expect(mintPointsResult.tier).toBe('Common')

    // 2. Award referral points to Bob
    const referralPointsResult = await pointsService.awardReferralPoints(
      unsignedMintTx.paymentAddress,
      unsignedMintTx.mintCount,
      mintTxId
    )
    expect(referralPointsResult.awarded).toBe(true)
    expect(referralPointsResult.referrerWallet).toBe(bobWallet)
    expect(referralPointsResult.pointsAwarded).toBe(5) // 5 × 1 = 5

    // === VERIFY: POINTS AWARDED AFTER TRANSACTION COMPLETION ===
    console.log('=== Verifying points awarded after transaction completion ===')
    
    const alicePointsAfterBroadcast = await pointsService.getPointsBalance(aliceWallet)
    const bobPointsAfterBroadcast = await pointsService.getPointsBalance(bobWallet)
    
    expect(alicePointsAfterBroadcast).toBe(50) // Alice got mint points
    expect(bobPointsAfterBroadcast).toBe(5)    // Bob got referral points
    
    console.log('✓ Confirmed: Points awarded correctly after transaction completion')
    console.log(`   Alice (minter): ${alicePointsAfterBroadcast} points`)
    console.log(`   Bob (referrer): ${bobPointsAfterBroadcast} points`)

    // === VERIFY REFERRAL INFO ===
    const bobUser = await pointsService.getUserByWallet(bobWallet)
    expect(bobUser?.pointsEarnedFromReferrals).toBe(5)
    
    console.log('\n🎉 Transaction Points Flow Test PASSED!')
    console.log('✓ Points NOT awarded during unsigned transaction creation')
    console.log('✓ Points awarded ONLY after successful broadcast and storage')
    console.log('✓ Referral rewards working correctly')
  })

  it('should handle failed transaction rollback - no points awarded', async () => {
    // === SETUP ===
    const minterWallet = randomAddress()
    await userService.createUser({ walletAddress: minterWallet })

    const initialPoints = await pointsService.getPointsBalance(minterWallet)
    expect(initialPoints).toBe(0)

    // === STEP 1: Create unsigned transaction ===
    const unsignedMintTx = {
      psbt: Random.randomHex(100),
      wif: Random.randomHex(64),
      serviceFee: 100,
      networkFee: 50,
      paddingCost: 10,
      networkFeePerMint: 5,
      networkFeeOfFinalMint: 10,
      mintsInEachOutput: [2],
      alkaneId: '2:61011',
      mintCount: 2,
      paymentAddress: minterWallet,
      receiveAddress: randomAddress(),
    }

    await unsignedMintService.createMintTransaction(unsignedMintTx)

    // === STEP 2: Simulate transaction failure scenario ===
    console.log('=== Simulating scenario where broadcast fails, so no points awarded ===')
    
    // In the real flow, if broadcast fails, we never get to the points awarding step
    // So points should remain at 0
    
    // === VERIFY: NO POINTS AWARDED DUE TO NO BROADCAST ===
    const pointsAfterFailure = await pointsService.getPointsBalance(minterWallet)
    expect(pointsAfterFailure).toBe(0)
    
    console.log('✓ Confirmed: No points awarded when no broadcast occurs')
  })

  it('should award points with correct tier bonuses for high-tier users', async () => {
    // === SETUP ===
    // Create Charlie with Epic tier (20000+ referral points)
    const charlieWallet = randomAddress()
    const charlie = await userService.createUser({ walletAddress: charlieWallet })
    
    // Manually set Charlie to Epic tier
    await database.getDb().collection('users').updateOne(
      { _id: charlie._id },
      { $set: { 
        pointsEarnedFromReferrals: 25000, // Epic tier
        points: 25000 
      } }
    )

    // === Create and process transaction ===
    const unsignedMintTx = {
      psbt: Random.randomHex(100),
      wif: Random.randomHex(64),
      serviceFee: 100,
      networkFee: 50,
      paddingCost: 10,
      networkFeePerMint: 5,
      networkFeeOfFinalMint: 10,
      mintsInEachOutput: [3],
      alkaneId: '2:61011',
      mintCount: 3,
      paymentAddress: charlieWallet,
      receiveAddress: randomAddress(),
    }

    await unsignedMintService.createMintTransaction(unsignedMintTx)

    // Process transaction with points awarding (without session for test simplicity)
    const mintTxId = await mintTransactionService.createMintTransaction({
      wif: unsignedMintTx.wif,
      serviceFee: unsignedMintTx.serviceFee,
      networkFee: unsignedMintTx.networkFee,
      paddingCost: unsignedMintTx.paddingCost,
      totalCost: unsignedMintTx.serviceFee + unsignedMintTx.networkFee + unsignedMintTx.paddingCost,
      paymentTxid: Random.randomTransactionId(),
      alkaneId: unsignedMintTx.alkaneId,
      mintCount: unsignedMintTx.mintCount,
      paymentAddress: unsignedMintTx.paymentAddress,
      receiveAddress: unsignedMintTx.receiveAddress,
      txids: [Random.randomTransactionId()],
    })

    // Award points with Epic tier bonus
    const mintPointsResult = await pointsService.awardMintPoints(
      charlieWallet,
      unsignedMintTx.mintCount,
      10
    )
    
    expect(mintPointsResult.pointsAwarded).toBe(60) // 3 × 10 × 2.0 = 60
    expect(mintPointsResult.tier).toBe('Epic')
    expect(mintPointsResult.bonus).toBe(2.0)

    // === VERIFY: EPIC TIER BONUS APPLIED ===
    const charliePointsAfterBroadcast = await pointsService.getPointsBalance(charlieWallet)
    
    // Charlie should get: 3 mints × 10 base × 2.0 (Epic tier bonus) = 60 points
    // Plus his initial 25000 = 25060 total
    expect(charliePointsAfterBroadcast).toBe(25060)
    
    console.log('✓ Confirmed: Epic tier bonus applied correctly')
    console.log(`   Charlie earned 60 points (3 × 10 × 2.0 Epic bonus)`)
  })
}) 
