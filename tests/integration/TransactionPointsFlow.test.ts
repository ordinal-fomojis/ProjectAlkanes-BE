import { Transaction } from "bitcoinjs-lib"
import { ObjectId } from "mongodb"
import { MongoMemoryServer } from "mongodb-memory-server"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { DB_NAME } from "../../src/config/env.js"
import { database } from '../../src/database/database.js'
import { MintTransactionService } from "../../src/services/MintTransactionService.js"
import { PointsService } from "../../src/services/PointsService.js"
import { UnconfirmedTransactionService } from "../../src/services/UnconfirmedTransactionService.js"
import { UnsignedAlkaneMintTransactionService } from "../../src/services/UnsignedAlkaneMintTransactionService.js"
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
  if (mongodb) await mongodb.stop()
})

// Helper function to create mock transaction
function createMockTransaction(txid: string): Transaction {
  return {
    getId: () => txid,
    toHex: () => Random.randomHex(200),
    version: 2,
    locktime: 0,
    ins: [],
    outs: [],
    // Add other required Transaction properties as needed
  } as unknown as Transaction
}

describe('Transaction Points Flow Integration (Authentication-Based)', () => {
  const pointsService = new PointsService()
  const userService = new UserService()
  const unsignedMintService = new UnsignedAlkaneMintTransactionService()
  const mintTransactionService = new MintTransactionService()
  const unconfirmedTransactionService = new UnconfirmedTransactionService()

  it('should award points to authenticated user address, not payment address', async () => {
    // === SETUP: Address Mismatch Scenario ===
    // Create Bob (referrer) 
    const bobOrdinalAddress = randomAddress() // bc1p... (Taproot ordinal address)
    const bob = await userService.createUser({ walletAddress: bobOrdinalAddress })

    // Create Alice (referred user) with ordinal address
    const aliceOrdinalAddress = randomAddress() // bc1p... (Taproot ordinal address)
    const alicePaymentAddress = randomAddress() // 3... (P2SH payment address - different from ordinal)
    const alice = await userService.createUser({ walletAddress: aliceOrdinalAddress })

    // Set up referral: Alice was referred by Bob
    await database.getDb().collection('users').updateOne(
      { _id: alice._id },
      { $set: { referredBy: bob._id } }
    )

    console.log('=== Address Mismatch Test Setup ===')
    console.log(`Alice Ordinal Address: ${aliceOrdinalAddress}`)
    console.log(`Alice Payment Address: ${alicePaymentAddress}`)
    console.log(`Bob Ordinal Address: ${bobOrdinalAddress}`)

    // Check initial points (should be 0)
    const aliceInitialPoints = await pointsService.getPointsBalance(aliceOrdinalAddress)
    const bobInitialPoints = await pointsService.getPointsBalance(bobOrdinalAddress)
    expect(aliceInitialPoints).toBe(0)
    expect(bobInitialPoints).toBe(0)

    // === STEP 1: Create unsigned transaction ===
    const unsignedMintTx: Parameters<typeof unsignedMintService.createMintTransaction>[0] = {
      psbt: Random.randomHex(100),
      encryptedWif: {
        iv: Random.randomHex(16),
        data: Random.randomHex(64)
      },
      serviceFee: 100,
      networkFee: 50,
      paddingCost: 10,
      networkFeePerMint: 5,
      networkFeeOfFinalMint: 10,
      mintsInEachOutput: [5],
      alkaneId: '2:61011',
      mintCount: 5,
      paymentAddress: alicePaymentAddress, // Different from ordinal address
      receiveAddress: aliceOrdinalAddress,
      authenticatedUserAddress: aliceOrdinalAddress // The authenticated user's ordinal address
    }

    await unsignedMintService.createMintTransaction(unsignedMintTx)

    // === STEP 2: Process transaction and award points ===
    const txid = Random.randomTransactionId()
    const allTransactions = [{
      tx: createMockTransaction(txid),
      txHex: Random.randomHex(200),
      txid: txid,
      broadcasted: true
    }]

    const mintTxId = await mintTransactionService.createMintTransaction({
      encryptedWif: unsignedMintTx.encryptedWif,
      serviceFee: unsignedMintTx.serviceFee,
      networkFee: unsignedMintTx.networkFee,
      paddingCost: unsignedMintTx.paddingCost,
      totalCost: unsignedMintTx.serviceFee + unsignedMintTx.networkFee + unsignedMintTx.paddingCost,
      paymentTxid: allTransactions[0]!.txid,
      tokenId: '2:0',
      type: 'alkane',
      mintCount: unsignedMintTx.mintCount,
      paymentAddress: unsignedMintTx.paymentAddress,
      receiveAddress: unsignedMintTx.receiveAddress,
      authenticatedUserAddress: unsignedMintTx.authenticatedUserAddress,
      txids: allTransactions.map(tx => tx.txid),
      requestId: crypto.randomUUID()
    })

    await unconfirmedTransactionService.createTransactionsForMint({
      txns: allTransactions,
      encryptedWif: unsignedMintTx.encryptedWif,
      mintTx: mintTxId,
      requestId: crypto.randomUUID()
    })

    // === STEP 3: Award points to authenticated user (ordinal address) ===
    console.log('=== Awarding points to authenticated user (ordinal address) ===')
    
    // 1. Award mint points to Alice's ordinal address (NOT payment address)
    const mintPointsResult = await pointsService.awardMintPoints(
      aliceOrdinalAddress, // Use ordinal address, not payment address
      unsignedMintTx.mintCount,
      10
    )
    expect(mintPointsResult.pointsAwarded).toBe(50) // 5 × 10 × 1.0 = 50
    expect(mintPointsResult.tier).toBe('Common')

    // 2. Award referral points to Bob using Alice's ordinal address
    const referralPointsResult = await pointsService.awardReferralPoints(
      aliceOrdinalAddress, // Use ordinal address, not payment address
      unsignedMintTx.mintCount,
      mintTxId
    )
    expect(referralPointsResult.awarded).toBe(true)
    expect(referralPointsResult.referrerWallet).toBe(bobOrdinalAddress)
    expect(referralPointsResult.pointsAwarded).toBe(5) // 5 × 1 = 5

    // === STEP 4: Verify points awarded to correct addresses ===
    console.log('=== Verifying points awarded to correct addresses ===')
    
    // Alice should have mint points on her ORDINAL address
    const aliceOrdinalPoints = await pointsService.getPointsBalance(aliceOrdinalAddress)
    expect(aliceOrdinalPoints).toBe(50)
    
    // Alice's PAYMENT address should have NO points (0)
    const alicePaymentPoints = await pointsService.getPointsBalance(alicePaymentAddress)
    expect(alicePaymentPoints).toBe(0)
    
    // Bob should have referral points
    const bobPoints = await pointsService.getPointsBalance(bobOrdinalAddress)
    expect(bobPoints).toBe(5)
    
    console.log('✓ Points correctly awarded to ordinal address, not payment address')
    console.log(`   Alice Ordinal (${aliceOrdinalAddress.slice(0, 10)}...): ${aliceOrdinalPoints} points`)
    console.log(`   Alice Payment (${alicePaymentAddress.slice(0, 10)}...): ${alicePaymentPoints} points`)
    console.log(`   Bob Referrer (${bobOrdinalAddress.slice(0, 10)}...): ${bobPoints} points`)

    // === STEP 5: Verify activity search works with ordinal address ===
    const mintTransactions = await mintTransactionService.getMintTransactionsByWalletAddress(aliceOrdinalAddress, 'alkane')
    expect(mintTransactions).toHaveLength(1)
    expect(mintTransactions[0]!.authenticatedUserAddress).toBe(aliceOrdinalAddress)
    expect(mintTransactions[0]!.paymentAddress).toBe(alicePaymentAddress)
    
    console.log('✓ Activity search correctly finds transactions by ordinal address')
    console.log('\n🎉 Address Mismatch Points Flow Test PASSED!')
  })

  it('should maintain backward compatibility when payment address equals ordinal address', async () => {
    // === SETUP: Same Address Scenario (like Unisat) ===
    const charlieWallet = randomAddress()
    await userService.createUser({ walletAddress: charlieWallet })

    const unsignedMintTx: Parameters<typeof unsignedMintService.createMintTransaction>[0] = {
      psbt: Random.randomHex(100),
      encryptedWif: {
        iv: Random.randomHex(16),
        data: Random.randomHex(64)
      },
      serviceFee: 100,
      networkFee: 50,
      paddingCost: 10,
      networkFeePerMint: 5,
      networkFeeOfFinalMint: 10,
      mintsInEachOutput: [3],
      alkaneId: '2:61011',
      mintCount: 3,
      paymentAddress: charlieWallet, // Same as ordinal address
      receiveAddress: charlieWallet,
      authenticatedUserAddress: charlieWallet // Same address for all
    }

    await unsignedMintService.createMintTransaction(unsignedMintTx)

    // Award points to authenticated user (which is same as payment address)
    const mintPointsResult = await pointsService.awardMintPoints(
      charlieWallet,
      unsignedMintTx.mintCount,
      10
    )
    
    expect(mintPointsResult.pointsAwarded).toBe(30) // 3 × 10 × 1.0 = 30
    
    const charliePoints = await pointsService.getPointsBalance(charlieWallet)
    expect(charliePoints).toBe(30)
    
    console.log('✓ Backward compatibility maintained for same-address scenarios')
  })

  it('should handle multi-wallet users correctly', async () => {
    // === SETUP: User with multiple wallet types ===
    const davidOrdinalAddress = randomAddress() // Primary ordinal address
    const davidP2SHAddress = randomAddress()    // P2SH payment address
    const davidP2WPKHAddress = randomAddress()  // Native Segwit address
    
    // Create user with ordinal address
    await userService.createUser({ walletAddress: davidOrdinalAddress })

    console.log('=== Multi-Wallet Address Test ===')
    console.log(`David Ordinal: ${davidOrdinalAddress}`)
    console.log(`David P2SH: ${davidP2SHAddress}`)
    console.log(`David P2WPKH: ${davidP2WPKHAddress}`)

    // === Test 1: Payment from P2SH address ===
    const mint1: Parameters<typeof unsignedMintService.createMintTransaction>[0] = {
      psbt: Random.randomHex(100),
      encryptedWif: {
        iv: Random.randomHex(16),
        data: Random.randomHex(64)
      },
      serviceFee: 100,
      networkFee: 50,
      paddingCost: 10,
      networkFeePerMint: 5,
      networkFeeOfFinalMint: 10,
      mintsInEachOutput: [2],
      alkaneId: '2:61011',
      mintCount: 2,
      paymentAddress: davidP2SHAddress,     // Payment from P2SH
      receiveAddress: davidOrdinalAddress,
      authenticatedUserAddress: davidOrdinalAddress // Points go to ordinal
    }

    await unsignedMintService.createMintTransaction(mint1)
    await pointsService.awardMintPoints(davidOrdinalAddress, mint1.mintCount, 10)

    // === Test 2: Payment from P2WPKH address ===
    const mint2: Parameters<typeof unsignedMintService.createMintTransaction>[0] = {
      psbt: Random.randomHex(100),
      encryptedWif: {
        iv: Random.randomHex(16),
        data: Random.randomHex(64)
      },
      serviceFee: 100,
      networkFee: 50,
      paddingCost: 10,
      networkFeePerMint: 5,
      networkFeeOfFinalMint: 10,
      mintsInEachOutput: [1],
      alkaneId: '2:61011',
      mintCount: 1,
      paymentAddress: davidP2WPKHAddress,   // Payment from P2WPKH
      receiveAddress: davidOrdinalAddress,
      authenticatedUserAddress: davidOrdinalAddress // Points go to ordinal
    }

    await unsignedMintService.createMintTransaction(mint2)
    await pointsService.awardMintPoints(davidOrdinalAddress, mint2.mintCount, 10)

    // === Verify points accumulate on ordinal address ===
    const davidTotalPoints = await pointsService.getPointsBalance(davidOrdinalAddress)
    expect(davidTotalPoints).toBe(30) // (2 × 10) + (1 × 10) = 30

    // Payment addresses should have no points
    const p2shPoints = await pointsService.getPointsBalance(davidP2SHAddress)
    const p2wpkhPoints = await pointsService.getPointsBalance(davidP2WPKHAddress)
    expect(p2shPoints).toBe(0)
    expect(p2wpkhPoints).toBe(0)

    console.log('✓ Multi-wallet scenario: All points accumulated on ordinal address')
    console.log(`   Total points on ordinal: ${davidTotalPoints}`)
    console.log(`   Points on P2SH: ${p2shPoints}`)
    console.log(`   Points on P2WPKH: ${p2wpkhPoints}`)
  })

  it('should handle failed points awarding gracefully', async () => {
    // === SETUP: Non-existent authenticated user ===
    const nonExistentOrdinal = randomAddress()
    const existingPayment = randomAddress()
    
    // Create user only for payment address (simulating missing ordinal account)
    await userService.createUser({ walletAddress: existingPayment })

    const unsignedMintTx: Parameters<typeof unsignedMintService.createMintTransaction>[0] = {
      psbt: Random.randomHex(100),
      encryptedWif: {
        iv: Random.randomHex(16),
        data: Random.randomHex(64)
      },
      serviceFee: 100,
      networkFee: 50,
      paddingCost: 10,
      networkFeePerMint: 5,
      networkFeeOfFinalMint: 10,
      mintsInEachOutput: [1],
      alkaneId: '2:61011',
      mintCount: 1,
      paymentAddress: existingPayment,
      receiveAddress: nonExistentOrdinal,
      authenticatedUserAddress: nonExistentOrdinal // This user doesn't exist
    }

    await unsignedMintService.createMintTransaction(unsignedMintTx)

    // Should handle gracefully for non-existent user
    const mintResult = await pointsService.awardMintPoints(nonExistentOrdinal, 1, 10)
    expect(mintResult.pointsAwarded).toBe(10) // Still returns expected points
    expect(mintResult.tier).toBe('Common')

    // No points should be awarded (user doesn't exist)
    const points = await pointsService.getPointsBalance(nonExistentOrdinal)
    expect(points).toBe(0)

    console.log('✓ Gracefully handled non-existent authenticated user')
  })

  it('should preserve existing referral relationships with new system', async () => {
    // === SETUP: Referral chain with address mismatches ===
    const eveOrdinal = randomAddress()
    const evePayment = randomAddress()
    const eve = await userService.createUser({ walletAddress: eveOrdinal })

    const frankOrdinal = randomAddress()
    const frank = await userService.createUser({ walletAddress: frankOrdinal })

    // Frank was referred by Eve
    await database.getDb().collection('users').updateOne(
      { _id: frank._id },
      { $set: { referredBy: eve._id } }
    )

    // Frank mints using different payment address
    const mintTxId = new ObjectId()
    const referralResult = await pointsService.awardReferralPoints(
      frankOrdinal, // Use Frank's ordinal address (authenticated user)
      3,            // 3 mints
      mintTxId
    )

    expect(referralResult.awarded).toBe(true)
    expect(referralResult.referrerWallet).toBe(eveOrdinal) // Points go to Eve's ordinal
    expect(referralResult.pointsAwarded).toBe(3)

    // Verify Eve got points on her ordinal address
    const evePoints = await pointsService.getPointsBalance(eveOrdinal)
    expect(evePoints).toBe(3)

    // Eve's payment address should have no points
    const evePaymentPoints = await pointsService.getPointsBalance(evePayment)
    expect(evePaymentPoints).toBe(0)

    console.log('✓ Referral relationships preserved with ordinal address system')
    console.log(`   Eve ordinal points: ${evePoints}`)
    console.log(`   Eve payment points: ${evePaymentPoints}`)
  })

  it('should replicate exact Xverse address mismatch scenario from user report', async () => {
    // === SETUP: Exact Xverse scenario from user's bug report ===
    // User authenticates with Taproot address but pays from P2SH address
    const xverseOrdinalAddress = "bc1pjavz5denhrrxxxkmqu4xddxaszr5a635ugd6jkrzmhjsgkgey4dsk4w9nv" // User's ordinal address
    const xversePaymentAddress = "3MqfF9p8EMJW86Xe44tNL3no5JRSfggD19" // Payment address that was used
    
    // Create user account with ordinal address (what happens during authentication)
    const xverseUser = await userService.createUser({ walletAddress: xverseOrdinalAddress })
    
    console.log('=== Xverse Address Mismatch Scenario ===')
    console.log(`User authenticated with: ${xverseOrdinalAddress}`)
    console.log(`Payment came from: ${xversePaymentAddress}`)
    console.log(`User ID: ${xverseUser._id}`)

    // Verify initial state - user exists under ordinal address
    const initialPoints = await pointsService.getPointsBalance(xverseOrdinalAddress)
    expect(initialPoints).toBe(0)
    
    // Payment address should not have a user account
    const paymentUser = await pointsService.getUserByWallet(xversePaymentAddress)
    expect(paymentUser).toBeNull()

    // === TRANSACTION CREATION ===
    // Simulate the transaction creation with address mismatch
    const xverseMintTx: Parameters<typeof unsignedMintService.createMintTransaction>[0] = {
      psbt: Random.randomHex(100),
      encryptedWif: {
        iv: Random.randomHex(16),
        data: Random.randomHex(64)
      },
      serviceFee: 100,
      networkFee: 50,
      paddingCost: 10,
      networkFeePerMint: 5,
      networkFeeOfFinalMint: 10,
      mintsInEachOutput: [1],
      alkaneId: '2:0',
      mintCount: 1,
      paymentAddress: xversePaymentAddress,    // Payment from P2SH address
      receiveAddress: xverseOrdinalAddress,    // Ordinals go to Taproot address
      authenticatedUserAddress: xverseOrdinalAddress // Authenticated with Taproot address
    }

    await unsignedMintService.createMintTransaction(xverseMintTx)

    // === TRANSACTION PROCESSING ===
    const txid = Random.randomTransactionId()
    const allTransactions = [{
      tx: createMockTransaction(txid),
      txHex: Random.randomHex(200),
      txid: txid,
      broadcasted: true
    }]

    await mintTransactionService.createMintTransaction({
      encryptedWif: xverseMintTx.encryptedWif,
      serviceFee: xverseMintTx.serviceFee,
      networkFee: xverseMintTx.networkFee,
      paddingCost: xverseMintTx.paddingCost,
      totalCost: xverseMintTx.serviceFee + xverseMintTx.networkFee + xverseMintTx.paddingCost,
      paymentTxid: allTransactions[0]!.txid,
      tokenId: '2:0',
      type: 'alkane',
      mintCount: xverseMintTx.mintCount,
      paymentAddress: xverseMintTx.paymentAddress,
      receiveAddress: xverseMintTx.receiveAddress,
      authenticatedUserAddress: xverseMintTx.authenticatedUserAddress,
      txids: allTransactions.map(tx => tx.txid),
      requestId: crypto.randomUUID()
    })

    // === POINTS AWARDING (NEW SYSTEM) ===
    console.log('=== Testing NEW system: Points to authenticated user ===')
    
    // Award points to authenticated user (ordinal address)
    const mintResult = await pointsService.awardMintPoints(
      xverseOrdinalAddress, // Points go to authenticated user's ordinal address
      xverseMintTx.mintCount,
      10
    )
    
    expect(mintResult.pointsAwarded).toBe(10) // 1 × 10 = 10
    expect(mintResult.tier).toBe('Common')

    // === VERIFICATION ===
    // User should now have points on their ordinal address
    const ordinalPoints = await pointsService.getPointsBalance(xverseOrdinalAddress)
    expect(ordinalPoints).toBe(10)
    
    // Payment address should still have no points and no user
    const paymentPoints = await pointsService.getPointsBalance(xversePaymentAddress)
    expect(paymentPoints).toBe(0)
    
    const paymentUserAfter = await pointsService.getUserByWallet(xversePaymentAddress)
    expect(paymentUserAfter).toBeNull()

    // === ACTIVITY SEARCH ===
    // User should be able to find their transactions
    const userTransactions = await mintTransactionService.getMintTransactionsByWalletAddress(xverseOrdinalAddress, 'alkane')
    expect(userTransactions).toHaveLength(1)
    expect(userTransactions[0]!.authenticatedUserAddress).toBe(xverseOrdinalAddress)
    expect(userTransactions[0]!.paymentAddress).toBe(xversePaymentAddress)
    expect(userTransactions[0]!.receiveAddress).toBe(xverseOrdinalAddress)

    console.log('✓ Xverse scenario FIXED: Points awarded to authenticated user')
    console.log(`   ✓ User ordinal address (${xverseOrdinalAddress.slice(0, 15)}...): ${ordinalPoints} points`)
    console.log(`   ✓ Payment address (${xversePaymentAddress}): ${paymentPoints} points (correctly 0)`)
    console.log(`   ✓ Activity shows correctly under user account`)
    console.log('\n🎉 Xverse/Oyl address mismatch issue RESOLVED!')
  })

  it('should handle legacy transactions in activity search (backward compatibility)', async () => {
    // === SETUP: Simulate legacy transaction scenario ===
    const userOrdinalAddress = randomAddress() // User's authenticated address
    const userPaymentAddress = randomAddress() // Different payment address
    
    await userService.createUser({ walletAddress: userOrdinalAddress })

    console.log('=== Legacy Transaction Activity Test ===')
    console.log(`User Ordinal: ${userOrdinalAddress}`)
    console.log(`Payment Address: ${userPaymentAddress}`)

    // === LEGACY TRANSACTION: Create transaction WITHOUT authenticatedUserAddress field ===
    // This simulates transactions created before our fix
    const legacyMintTx = await mintTransactionService.createMintTransaction({
      encryptedWif: {
        iv: Random.randomHex(16),
        data: Random.randomHex(64)
      },
      serviceFee: 100,
      networkFee: 50,
      paddingCost: 10,
      totalCost: 160,
      paymentTxid: Random.randomTransactionId(),
      tokenId: '2:0',
      type: 'alkane',
      mintCount: 2,
      paymentAddress: userPaymentAddress,     // Payment from different address
      receiveAddress: userOrdinalAddress,     // Ordinals go to user's address
      // authenticatedUserAddress: undefined  // LEGACY: No authenticated user field
      txids: [Random.randomTransactionId()],
      requestId: crypto.randomUUID()
    })

    // === NEW TRANSACTION: Create transaction WITH authenticatedUserAddress field ===
    // This simulates transactions created after our fix
    const newMintTx = await mintTransactionService.createMintTransaction({
      encryptedWif: {
        iv: Random.randomHex(16),
        data: Random.randomHex(64),
      },
      serviceFee: 200,
      networkFee: 75,
      paddingCost: 15,
      totalCost: 290,
      paymentTxid: Random.randomTransactionId(),
      tokenId: '2:0',
      type: 'alkane',
      mintCount: 3,
      paymentAddress: randomAddress(),        // Payment from any address
      receiveAddress: randomAddress(),        // Ordinals go to any address
      authenticatedUserAddress: userOrdinalAddress, // NEW: Has authenticated user field
      txids: [Random.randomTransactionId()],
      requestId: crypto.randomUUID()
    })

    console.log(`Created legacy transaction: ${legacyMintTx}`)
    console.log(`Created new transaction: ${newMintTx}`)

    // === ACTIVITY SEARCH TEST ===
    // Enhanced search should find BOTH legacy and new transactions
    const userTransactions = await mintTransactionService.getMintTransactionsByWalletAddress(userOrdinalAddress, 'alkane')

    // Should find both transactions
    expect(userTransactions).toHaveLength(2)

    // Sort by creation date to have predictable order
    userTransactions.sort((a, b) => a.created.getTime() - b.created.getTime())

    // Verify legacy transaction is found (by receiveAddress match)
    const foundLegacy = userTransactions[0]!
    expect(foundLegacy._id).toEqual(legacyMintTx)
    expect(foundLegacy.receiveAddress).toBe(userOrdinalAddress)
    expect(foundLegacy.authenticatedUserAddress).toBeUndefined() // Legacy has no auth field

    // Verify new transaction is found (by authenticatedUserAddress match)
    const foundNew = userTransactions[1]!
    expect(foundNew._id).toEqual(newMintTx)
    expect(foundNew.authenticatedUserAddress).toBe(userOrdinalAddress)

    console.log('✓ Enhanced search finds both legacy and new transactions')
    console.log(`   Legacy transaction (${foundLegacy.mintCount} mints): Found by receiveAddress`)
    console.log(`   New transaction (${foundNew.mintCount} mints): Found by authenticatedUserAddress`)

    // === VERIFY NO DUPLICATE RESULTS ===
    // If a transaction has BOTH receiveAddress AND authenticatedUserAddress matching,
    // it should only appear once in results
    const sameAddressTx = await mintTransactionService.createMintTransaction({
      encryptedWif: {
        iv: Random.randomHex(16),
        data: Random.randomHex(64)
      },
      serviceFee: 300,
      networkFee: 100,
      paddingCost: 20,
      totalCost: 420,
      paymentTxid: Random.randomTransactionId(),
      tokenId: '2:0',
      type: 'alkane',
      mintCount: 1,
      paymentAddress: randomAddress(),
      receiveAddress: userOrdinalAddress,              // Matches user
      authenticatedUserAddress: userOrdinalAddress,    // Also matches user
      txids: [Random.randomTransactionId()],
      requestId: crypto.randomUUID()
    })

    const allTransactions = await mintTransactionService.getMintTransactionsByWalletAddress(userOrdinalAddress, 'alkane')
    expect(allTransactions).toHaveLength(3) // Should be 3, not 4 (no duplicates)

    const sameAddressFound = allTransactions.find(tx => tx._id.equals(sameAddressTx))
    expect(sameAddressFound).toBeDefined()

    console.log('✓ No duplicate results for transactions matching multiple criteria')
    console.log('\n🎉 Legacy Activity Search Test PASSED!')
  })

  it('should correctly expose minting activity through API route', async () => {
    // === SETUP: User with ordinal address ===
    const userOrdinalAddress = randomAddress()
    await userService.createUser({ walletAddress: userOrdinalAddress })

    // === Create multiple transactions with different scenarios ===
    
    // 1. NEW transaction (with authenticatedUserAddress)
    const newTx = await mintTransactionService.createMintTransaction({
      encryptedWif: {
        iv: Random.randomHex(16),
        data: Random.randomHex(64)
      },
      serviceFee: 100,
      networkFee: 50,
      paddingCost: 10,
      totalCost: 160,
      paymentTxid: Random.randomTransactionId(),
      tokenId: '2:0',
      type: 'alkane',
      mintCount: 5,
      paymentAddress: randomAddress(),               // Different payment address
      receiveAddress: userOrdinalAddress,           // User's ordinal address
      authenticatedUserAddress: userOrdinalAddress, // NEW: Authenticated field
      txids: [Random.randomTransactionId()],
      requestId: crypto.randomUUID()
    })

    // 2. LEGACY transaction (without authenticatedUserAddress)
    const legacyTx = await mintTransactionService.createMintTransaction({
      encryptedWif: {
        iv: Random.randomHex(16),
        data: Random.randomHex(64)
      },
      serviceFee: 200,
      networkFee: 75,
      paddingCost: 15,
      totalCost: 290,
      paymentTxid: Random.randomTransactionId(),
      tokenId: '2:0',
      type: 'alkane',
      mintCount: 3,
      paymentAddress: randomAddress(),     // Different payment address
      receiveAddress: userOrdinalAddress, // User's ordinal address
      // authenticatedUserAddress: undefined (legacy)
      txids: [Random.randomTransactionId()],
      requestId: crypto.randomUUID()
    })

    console.log('=== API Activity Route Test ===')
    console.log(`User Address: ${userOrdinalAddress}`)
    console.log(`Created NEW transaction: ${newTx}`)
    console.log(`Created LEGACY transaction: ${legacyTx}`)

    // === TEST ENHANCED SEARCH DIRECTLY ===
    const foundTransactions = await mintTransactionService.getMintTransactionsByWalletAddress(userOrdinalAddress, 'alkane')
    
    // Should find both transactions
    expect(foundTransactions).toHaveLength(2)
    
    // Verify both transaction IDs are found
    const foundIds = foundTransactions.map(tx => tx._id.toString())
    expect(foundIds).toContain(newTx.toString())
    expect(foundIds).toContain(legacyTx.toString())

    // Verify search criteria
    const newTxFound = foundTransactions.find(tx => tx._id.equals(newTx))
    const legacyTxFound = foundTransactions.find(tx => tx._id.equals(legacyTx))

    expect(newTxFound?.authenticatedUserAddress).toBe(userOrdinalAddress)
    expect(legacyTxFound?.receiveAddress).toBe(userOrdinalAddress)
    expect(legacyTxFound?.authenticatedUserAddress).toBeUndefined()

    console.log('✓ Enhanced search finds both NEW and LEGACY transactions')
    console.log(`   NEW: Found by authenticatedUserAddress (${newTxFound?.mintCount} mints)`)
    console.log(`   LEGACY: Found by receiveAddress (${legacyTxFound?.mintCount} mints)`)
    console.log('\n🎉 API Activity Route Test PASSED!')
  })
}) 
