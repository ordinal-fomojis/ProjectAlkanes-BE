import { Request, Response, Router } from 'express'
import { z } from 'zod'
import { UnsignedMintTransactionService } from '../services/UnsignedMintTransactionService.js'
import { parse } from '../utils/parse.js'

const router = Router();

const ParamsSchema = z.object({
  feeRate: z.number({ coerce: true }),
  paymentAddress: z.string(), 
  paymentPubkey: z.string(),
  receiveAddress: z.string(),
  alkaneId: z.string(),
  mintCount: z.number({ coerce: true }).min(1)
})

router.get('/create', async (req: Request, res: Response): Promise<void> => {
  const {
    feeRate, paymentAddress, paymentPubkey,
    receiveAddress, alkaneId, mintCount
  } = parse(ParamsSchema, req.query)
  const service = new UnsignedMintTransactionService()
  const mintTx = await service.getMintTransaction(feeRate, paymentAddress, paymentPubkey,
    receiveAddress, alkaneId, mintCount);

  res.status(200).json({
    success: true,
    message: 'Successfully fetched tokens',
    data: mintTx
  })
})

export default router; 
