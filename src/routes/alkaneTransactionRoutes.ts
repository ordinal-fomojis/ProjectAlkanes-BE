import { Psbt } from 'bitcoinjs-lib'
import { Router } from 'express'
import { z } from 'zod'
import { MOCK_BTC } from '../config/env-vars.js'
import { database } from '../database/database.js'
import { AuthenticatedRequest, authenticateJWT } from '../middleware/auth.js'
import { requireReferral } from '../middleware/referralGate.js'
import { AlkaneTokenV2Service } from '../services/AlkaneTokenService.js'
import { MintTransactionService } from '../services/MintTransactionService.js'
import { PointsService } from '../services/PointsService.js'
import { ArchivedTransactionService } from '../services/TransactionArchiveService.js'
import { UnconfirmedTransactionService } from '../services/UnconfirmedTransactionService.js'
import { UnsignedAlkaneMintTransactionService } from '../services/UnsignedAlkaneMintTransactionService.js'
import { UserError } from '../utils/errors.js'
import { parse } from '../utils/parse.js'
import { sendTransaction } from '../utils/rpc/sendTransactions.js'
import { throttledPromiseAll } from '../utils/throttledPromise.js'
import { createAlkaneMintScript } from '../utils/transaction/alkanes/createAlkaneMintScript.js'
import { createAlkaneMintTransactionChain } from '../utils/transaction/alkanes/createAlkaneMintTransactionChain.js'
import { createAlkaneUserTransaction } from '../utils/transaction/alkanes/createAlkaneUserTransaction.js'
import { getUtxos } from '../utils/transaction/getUtxos.js'
import { validatePsbtWithReference } from '../utils/transaction/validatePsbtWithReference.js'
import { decryptWif } from '../utils/wif/decryptWif.js'
import { encryptWif } from '../utils/wif/encryptWif.js'

const router = Router();

const CreateTransactionParamsSchema = z.object({
  feeRate: z.coerce.number(),
  paymentAddress: z.string(), 
  paymentPubkey: z.string(),
  receiveAddress: z.string(),
  userAddress: z.string().optional(), // Optional user address for points awarding
  alkaneId: z.string(),
  mintCount: z.coerce.number().min(1).max(1000)
})

router.get('/', authenticateJWT, requireReferral, async (req: AuthenticatedRequest, res) => {
  const {
    feeRate, paymentAddress, paymentPubkey,
    receiveAddress, userAddress, alkaneId, mintCount
  } = parse(CreateTransactionParamsSchema, req.query)

  const service = new UnsignedAlkaneMintTransactionService()
  await validateAlkaneToken(alkaneId, mintCount)

  const utxos = await getUtxos(paymentAddress)
  const {
    psbt, internalKey, serviceFee, networkFee, paddingCost, feePerMint, feeOfFinalMint, mintsInEachOutput
  } = await createAlkaneUserTransaction({
    feeRate, paymentAddress, paymentPubkey, receiveAddress, alkaneId, mintCount, utxos
  })

  const psbtHex = psbt.toHex()
  const id = await service.createMintTransaction({
    psbt: psbt.toHex(),
    encryptedWif: await encryptWif(internalKey),
    serviceFee: Number(serviceFee),
    networkFee: Number(networkFee),
    paddingCost: Number(paddingCost),
    networkFeePerMint: Number(feePerMint),
    networkFeeOfFinalMint: Number(feeOfFinalMint),
    mintsInEachOutput,
    alkaneId,
    mintCount,
    paymentAddress,
    receiveAddress,
    authenticatedUserAddress: userAddress || receiveAddress // Use userAddress if provided, otherwise fall back to receiveAddress
  })

  // Points will be awarded later after successful broadcasting, not here
  
  res.status(200).json({
    success: true,
    message: 'Successfully created transaction',
    data: { id, psbtHex }
  })
})

const PostTransactionBodySchema = z.object({
  psbt: z.string(),
  id: z.string()
})

router.post('/', authenticateJWT, requireReferral, async (req: AuthenticatedRequest, res) => {
  const { psbt, id } = parse(PostTransactionBodySchema, req.body)
  const unsignedMints = new UnsignedAlkaneMintTransactionService()
  const mintTxns = new MintTransactionService()
  const txnService = new UnconfirmedTransactionService()
  const archiveService = new ArchivedTransactionService()
  const pointsService = new PointsService()
  const mintTx = await unsignedMints.getMintTransactionById(id)

  if (mintTx === null) {
    res.status(404).json({
      success: false,
      message: 'Mint transaction not found or expired'
    })
    return
  }

  await validateAlkaneToken(mintTx.alkaneId, mintTx.mintCount)

  const signedPsbt = Psbt.fromHex(psbt)
  const unsignedPsbt = Psbt.fromHex(mintTx.psbt)

  if (!validatePsbtWithReference(signedPsbt, unsignedPsbt)) {
    res.status(400).json({
      success: false,
      message: 'Signed PSBT does not match the expected PSBT'
    })
    return
  }

  const tx = signedPsbt.extractTransaction()
  const paymentTx = { tx, txHex: tx.toHex(), txid: tx.getId(), broadcasted: true }
  
  const key = await decryptWif(mintTx.encryptedWif)
  const runescript = createAlkaneMintScript(mintTx.alkaneId)
  const transactions = (await throttledPromiseAll(mintTx.mintsInEachOutput.map((mintCount, index) => () => createAlkaneMintTransactionChain({
    feePerMint: BigInt(mintTx.networkFeePerMint),
    feeOfFinalMint: BigInt(mintTx.networkFeeOfFinalMint),
    runescript, key,
    mintCount, outputAddress: mintTx.receiveAddress,
    utxo: { txid: paymentTx.txid, vout: index, value: tx.outs[index]?.value ?? 0n }
  })))).map(chain => chain.map(tx => ({ tx, txHex: tx.toHex(), txid: tx.getId(), broadcasted: false })))

  const allTransactions = [paymentTx].concat(transactions.flat())

  const requestId = crypto.randomUUID()

  await archiveService.createArchivedTransactions({
    txns: allTransactions,
    encryptedWif: mintTx.encryptedWif,
    requestId
  })

  await database.withTransaction(async (session) => {
    const mintTxId = await mintTxns.createMintTransaction({
      encryptedWif: mintTx.encryptedWif,
      serviceFee: mintTx.serviceFee,
      networkFee: mintTx.networkFee,
      paddingCost: mintTx.paddingCost,
      totalCost: mintTx.totalCost,
      paymentTxid: paymentTx.txid,
      tokenId: mintTx.alkaneId,
      type: 'alkane',
      mintCount: mintTx.mintCount,
      paymentAddress: mintTx.paymentAddress,
      receiveAddress: mintTx.receiveAddress,
      authenticatedUserAddress: mintTx.authenticatedUserAddress,
      txids: allTransactions.map(tx => tx.txid),
      requestId
    }, session)
    
    await txnService.createTransactionsForMint({
      txns: allTransactions,
      encryptedWif: mintTx.encryptedWif,
      mintTx: mintTxId,
      requestId
    }, session)

    const userWalletAddress = mintTx.authenticatedUserAddress || mintTx.receiveAddress
    console.log(`Awarding points to user: ${userWalletAddress} (payment from: ${mintTx.paymentAddress})`)
    
    // 1. Award mint points to the user
    const mintPointsResult = await pointsService.awardMintPoints(
      userWalletAddress, // Use user's ordinal address
      mintTx.mintCount,      // Number of tokens minted
      10,                    // Base points per mint
      session                // Use the same session for consistency
    )
    console.log(`Awarded ${mintPointsResult.pointsAwarded} mint points (${mintTx.mintCount * 10} base × ${mintPointsResult.bonus} ${mintPointsResult.tier} bonus) to user ${userWalletAddress}`)
    
    // 2. Award fixed referral points to the referrer (1 point per mint, no bonus)
    const referralPointsResult = await pointsService.awardReferralPoints(
      userWalletAddress, // Use user's ordinal address
      mintTx.mintCount,      // Number of tokens minted = points to award to referrer
      mintTxId,              // The mint transaction ID for tracking
      session                // Use the same session for consistency
    )
    
    if (referralPointsResult.awarded) {
      console.log(`Awarded ${referralPointsResult.pointsAwarded} fixed referral points to referrer ${referralPointsResult.referrerWallet} for alkane mint by user ${userWalletAddress}`)
    }

    // Broadcast inside the transaction, so if it fails, we can rollback
    // It is done last, so if anything above fails, the transaction isn't broadcasted and everything is rolled back
    // (note: the archive transactions are not in this transaction, so they are not rolled back, in case we need them in emergency)
    if (!MOCK_BTC()) {
      try {
        await sendTransaction(paymentTx.txHex)
      } catch (error: unknown) {
        console.warn('Failed to broadcast payment transaction:', error)
        throw new UserError('Failed to broadcast payment transaction').withStatus(500)
      }
    }
  })

  res.status(200).json({
    success: true,
    message: 'Successfully created mint transactions',
    data: { txid: paymentTx.txid, mintCount: mintTx.mintCount }
  })
})

async function validateAlkaneToken(alkaneId: string, mintCount: number) {
  const alkanesService = new AlkaneTokenV2Service()
  const alkane = await alkanesService.getAlkaneById(alkaneId)
  if (alkane === null) {
    throw new UserError('Alkane token not found').withStatus(404)
  }
  if (!alkane.mintable) {
    throw new UserError('Alkane token is not mintable').withStatus(400)
  }
  if (alkane.mintedOut) {
    throw new UserError('Alkane token has already minted out').withStatus(400)
  }
  const mintCap = BigInt(alkane.mintCountCap)
  const mintsLeft = mintCap - BigInt(alkane.currentMintCount)
  if (mintsLeft < BigInt(mintCount)) {
    throw new UserError(`Not enough mints left. Only ${mintsLeft} mints available`).withStatus(400)
  }
}

export default router;
