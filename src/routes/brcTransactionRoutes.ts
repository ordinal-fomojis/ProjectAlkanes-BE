import { Psbt } from 'bitcoinjs-lib'
import { Router } from 'express'
import { bigDecimal } from 'js-big-decimal'
import { z } from 'zod'
import { MOCK_BTC } from '../config/env.js'
import { database } from '../database/database.js'
import { AuthenticatedRequest, authenticateJWT } from '../middleware/auth.js'
import { requireReferral } from '../middleware/referralGate.js'
import { BrcToken, BrcTokenService } from '../services/BrcTokenService.js'
import { MintTransactionService } from '../services/MintTransactionService.js'
import { PointsService } from '../services/PointsService.js'
import { ArchivedTransactionService } from '../services/TransactionArchiveService.js'
import { UnconfirmedTransactionService } from '../services/UnconfirmedTransactionService.js'
import { UnsignedBrcMintTransactionService } from '../services/UnsignedBrcMintTransactionService.js'
import { UserError } from '../utils/errors.js'
import { parse } from '../utils/parse.js'
import { sendTransaction } from '../utils/rpc/sendTransactions.js'
import { createBrcRevealTransactions } from '../utils/transaction/brc/createBrcRevealTransactions.js'
import { createBrcUserTransaction } from '../utils/transaction/brc/createBrcUserTransaction.js'
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
  ticker: z.string(),
  mintCount: z.coerce.number().min(1).max(1000),
  mintAmount: z.string().optional()
})

router.get('/', authenticateJWT, requireReferral, async (req: AuthenticatedRequest, res) => {
  const {
    feeRate, paymentAddress, paymentPubkey,
    receiveAddress, userAddress, ticker, mintAmount = null, mintCount
  } = parse(CreateTransactionParamsSchema, req.query)
  const tokenService = new BrcTokenService()
  const token = await tokenService.getBrcByTicker(ticker)

  const service = new UnsignedBrcMintTransactionService()
  validateBrcToken(token, mintAmount, mintCount)

  const utxos = await getUtxos(paymentAddress)
  const { psbt, internalKey, serviceFee, networkFee, paddingCost, amountMinted } = await createBrcUserTransaction({
    feeRate, paymentAddress, paymentPubkey, receiveAddress, token, mintAmount, mintCount, utxos
  })

  const psbtHex = psbt.toHex()
  const id = await service.createMintTransaction({
    psbt: psbt.toHex(),
    encryptedWif: await encryptWif(internalKey),
    ticker: token.ticker,
    serviceFee,
    networkFee,
    paddingCost,
    mintCount,
    mintAmount: amountMinted.getValue(),
    paymentAddress,
    receiveAddress,
    authenticatedUserAddress: userAddress || receiveAddress
  })
  
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
  const unsignedMints = new UnsignedBrcMintTransactionService()
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

  const tokenService = new BrcTokenService()
  const token = await tokenService.getBrcByTicker(mintTx.ticker)
  validateBrcToken(token, mintTx.mintAmount, mintTx.mintCount)

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
  
  const reveals = createBrcRevealTransactions({
    paymentTx: tx,
    receiveAddress: mintTx.receiveAddress,
    mintCount: mintTx.mintCount,
    token,
    key,
    mintAmount: mintTx.mintAmount
  }).map(tx => ({ tx, txHex: tx.toHex(), txid: tx.getId(), broadcasted: false }))

  const allTransactions = [paymentTx].concat(reveals)

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
      tokenId: mintTx.ticker,
      type: 'brc',
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
      console.log(`Awarded ${referralPointsResult.pointsAwarded} fixed referral points to referrer ${referralPointsResult.referrerWallet} for brc20 mint by user ${userWalletAddress}`)
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

export default router;

function validateBrcToken(token: BrcToken | null, mintAmountStr: string | null, mintCount: number): asserts token is BrcToken {
  if (token === null) {
    throw new UserError('BRC token not found').withStatus(404)
  }
  if (!token.mintable) {
    throw new UserError('BRC token is not mintable').withStatus(400)
  }
  if (token.mintedOut) {
    throw new UserError('BRC token has already minted out').withStatus(400)
  }
  const mintAmount = new bigDecimal(mintAmountStr ?? token.limit).round(token.decimal)
  
  const limit = new bigDecimal(token.limit)
  if (mintAmount.compareTo(limit) > 0) {
    throw new UserError(`Mint amount exceeds limit of ${limit.getValue()}`).withStatus(400)
  }

  // We only need to validate this if minting more than once, because if a mint exceeds the cap,
  // the user will just get whatever is remaining
  if (mintCount > 1) {
    const mintCap = new bigDecimal(token.max)
    const currentSupply = new bigDecimal(token.minted)
    const amountLeft = mintCap.subtract(currentSupply)
    const totalMintAmount = mintAmount.multiply(new bigDecimal(mintCount))
    if (amountLeft.compareTo(totalMintAmount) < 0) {
      throw new UserError(`Not enough mints left. Only ${amountLeft.getValue()} mints available`).withStatus(400)
    }
  }
}
