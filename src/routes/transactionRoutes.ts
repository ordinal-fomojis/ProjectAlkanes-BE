import { Psbt } from 'bitcoinjs-lib'
import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { z } from 'zod'
import { MOCK_BTC } from '../config/constants.js'
import { database } from '../config/database.js'
import { AlkaneTokenService } from '../services/AlkaneTokenService.js'
import { MintTransactionService } from '../services/MintTransactionService.js'
import { PointsService } from '../services/PointsService.js'
import { UnconfirmedTransactionService } from '../services/UnconfirmedTransactionService.js'
import { UnsignedMintTransactionService } from '../services/UnsignedMintTransactionService.js'
import { UserError } from '../utils/errors.js'
import { parse } from '../utils/parse.js'
import { sendTransaction } from '../utils/rpc/sendTransactions.js'
import { throttledPromiseAll } from '../utils/throttledPromise.js'
import { createAlkaneMintTransactionChain } from '../utils/transaction/createAlkaneMintTransactionChain.js'
import { createUserTransaction } from '../utils/transaction/createUserTransaction.js'
import { getUtxos } from '../utils/transaction/getUtxos.js'
import { createScriptForAlkaneMint } from '../utils/transaction/protostone/createScriptForAlkaneMint.js'
import { fromWIF } from '../utils/transaction/utils/keys.js'
import { validatePsbtWithReference } from '../utils/transaction/validatePsbtWithReference.js'

const router = Router();

const CreateTransactionParamsSchema = z.object({
  feeRate: z.coerce.number(),
  paymentAddress: z.string(), 
  paymentPubkey: z.string(),
  receiveAddress: z.string(),
  alkaneId: z.string(),
  mintCount: z.coerce.number().min(1)
})

router.get('/', async (req, res) => {
  const {
    feeRate, paymentAddress, paymentPubkey,
    receiveAddress, alkaneId, mintCount
  } = parse(CreateTransactionParamsSchema, req.query)

  const service = new UnsignedMintTransactionService()
  await validateAlkaneToken(alkaneId)
  
  const utxos = await getUtxos(paymentAddress)
  const {
    psbt, internalKey, serviceFee, networkFee, paddingCost, feePerMint, mintsInEachOutput
  } = await createUserTransaction({
    feeRate, paymentAddress, paymentPubkey, receiveAddress, alkaneId, mintCount, utxos
  })

  const psbtHex = psbt.toHex()
  const id = await service.createMintTransaction({
    psbt: psbt.toHex(),
    wif: internalKey.toWIF(),
    serviceFee,
    networkFee,
    paddingCost,
    networkFeePerMint: feePerMint,
    mintsInEachOutput,
    alkaneId,
    mintCount,
    paymentAddress,
    receiveAddress
  })

  // Award referral points immediately when mint is initiated (from temporary storage)
  try {
    const pointsService = new PointsService()
    const pointsResult = await pointsService.awardReferralPoints(
      paymentAddress, // The wallet that is paying for minting
      mintCount,      // Number of tokens minted = points to award
      new ObjectId(id) // The unsigned mint transaction ID for tracking
      // No session parameter - this is not in a transaction
    )
    
    if (pointsResult.awarded) {
      console.log(`Successfully awarded ${pointsResult.pointsAwarded} points (${pointsResult.basePoints} base × ${pointsResult.bonus} ${pointsResult.tier} bonus) to referrer ${pointsResult.referrerWallet} for mint initiation by ${paymentAddress}`)
    }
  } catch (pointsError) {
    // Log the error but don't fail the mint transaction creation
    console.error('Error awarding referral points during mint initiation:', pointsError)
    // Points awarding failure should not block the mint transaction creation
  }

  res.status(200).json({
    success: true,
    message: 'Successfully fetched tokens',
    data: { id, psbtHex }
  })
})

const PostTransactionBodySchema = z.object({
  psbt: z.string(),
  id: z.string()
})

router.post('/', async (req, res) => {
  const { psbt, id } = parse(PostTransactionBodySchema, req.body)
  const unsignedMints = new UnsignedMintTransactionService()
  const mintTxns = new MintTransactionService()
  const txnService = new UnconfirmedTransactionService()
  const mintTx = await unsignedMints.getMintTransactionById(id)

  if (mintTx === null) {
    res.status(404).json({
      success: false,
      message: 'Mint transaction not found or expired'
    })
    return
  }

  await validateAlkaneToken(mintTx.alkaneId)

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
  
  const key = fromWIF(mintTx.wif)
  const runescript = createScriptForAlkaneMint(mintTx.alkaneId)
  const transactions = (await throttledPromiseAll(mintTx.mintsInEachOutput.map((mintCount, index) => () => createAlkaneMintTransactionChain({
    feePerMint: mintTx.networkFeePerMint,
    runescript, key,
    mintCount, outputAddress: mintTx.receiveAddress,
    utxo: { txid: paymentTx.txid, vout: index, value: tx.outs[index]?.value ?? 0 }
  })))).map(chain => chain.map(tx => ({ tx, txHex: tx.toHex(), txid: tx.getId(), broadcasted: false })))

  if (!MOCK_BTC) {
    try {
      await sendTransaction(paymentTx.txHex)
    } catch (error: unknown) {
      console.warn('Failed to broadcast payment transaction:', error)
      throw new UserError('Failed to broadcast payment transaction').withStatus(500)
    }
  }

  const allTransactions = [paymentTx].concat(transactions.flat())

  await database.withTransaction(async (session) => {
    const id = await mintTxns.createMintTransaction({
      wif: mintTx.wif,
      serviceFee: mintTx.serviceFee,
      networkFee: mintTx.networkFee,
      paddingCost: mintTx.paddingCost,
      totalCost: mintTx.totalCost,
      paymentTxid: paymentTx.txid,
      alkaneId: mintTx.alkaneId,
      mintCount: mintTx.mintCount,
      paymentAddress: mintTx.paymentAddress,
      receiveAddress: mintTx.receiveAddress,
      txids: allTransactions.map(tx => tx.txid),
    }, session)
    await txnService.createTransactionsForMint({
      txns: allTransactions,
      wif: mintTx.wif,
      mintTx: id
    }, session)
  })

  res.status(200).json({
    success: true,
    message: 'Successfully created mint transactions',
    data: { txid: paymentTx.txid, mintCount: mintTx.mintCount }
  })
})

async function validateAlkaneToken(alkaneId: string) {
  const alkanesService = new AlkaneTokenService()
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
}

export default router; 
