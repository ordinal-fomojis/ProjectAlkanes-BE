import { Router } from 'express'
import { bigDecimal } from 'js-big-decimal'
import { z } from 'zod'
import { AuthenticatedRequest, authenticateJWT } from '../middleware/auth.js'
import { requireReferral } from '../middleware/referralGate.js'
import { BrcToken, BrcTokenService } from '../services/BrcTokenService.js'
import { UnsignedBrcMintTransactionService } from '../services/UnsignedBrcMintTransactionService.js'
import { UserError } from '../utils/errors.js'
import { parse } from '../utils/parse.js'
import { createBrcUserTransaction } from '../utils/transaction/brc/createBrcUserTransaction.js'
import { getUtxos } from '../utils/transaction/getUtxos.js'

const router = Router();

const CreateTransactionParamsSchema = z.object({
  feeRate: z.coerce.number(),
  paymentAddress: z.string(), 
  paymentPubkey: z.string(),
  receiveAddress: z.string(),
  userAddress: z.string().optional(), // Optional user address for points awarding
  ticker: z.string(),
  mintCount: z.coerce.number().min(1),
  mintAmount: z.string()
})

router.get('/', authenticateJWT, requireReferral, async (req: AuthenticatedRequest, res) => {
  const {
    feeRate, paymentAddress, paymentPubkey,
    receiveAddress, userAddress, ticker, mintAmount: mintAmountStr, mintCount
  } = parse(CreateTransactionParamsSchema, req.query)
  const tokenService = new BrcTokenService()
  const token = await tokenService.getBrcByTicker(ticker)

  const service = new UnsignedBrcMintTransactionService()
  validateBrcToken(token, mintAmountStr, mintCount)
  const mintAmount = convertAmount(mintAmountStr, token)

  const utxos = await getUtxos(paymentAddress)
  const { psbt, internalKey, serviceFee, networkFee, paddingCost } = await createBrcUserTransaction({
    feeRate, paymentAddress, paymentPubkey, receiveAddress, ticker, mintAmount, mintCount, utxos
  })

  const psbtHex = psbt.toHex()
  const id = await service.createMintTransaction({
    psbt: psbt.toHex(),
    wif: internalKey.toWIF(),
    serviceFee,
    networkFee,
    paddingCost,
    mintCount,
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


function validateBrcToken(token: BrcToken | null, mintAmountStr: string, mintCount: number): asserts token is BrcToken {
  if (token === null) {
    throw new UserError('BRC token not found').withStatus(404)
  }
  if (!token.mintable) {
    throw new UserError('BRC token is not mintable').withStatus(400)
  }
  if (token.mintedOut) {
    throw new UserError('BRC token has already minted out').withStatus(400)
  }
  const mintCap = new bigDecimal(token.max)
  const currentSupply = new bigDecimal(token.minted)
  const amountLeft = mintCap.subtract(currentSupply)
  const mintAmount = convertAmount(mintAmountStr, token)
  const totalMintAmount = mintAmount.multiply(new bigDecimal(mintCount))
  if (amountLeft.compareTo(totalMintAmount) < 0) {
    throw new UserError(`Not enough mints left. Only ${amountLeft.getValue()} mints available`).withStatus(400)
  }
}

function convertAmount(amount: string, token: BrcToken) {
  return new bigDecimal(amount).round(token.decimal)
}
