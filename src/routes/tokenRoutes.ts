import { Request, Response, Router } from 'express'
import { z } from 'zod'
import { AlkaneTokenService } from '../services/AlkaneTokenService.js'
import { parse } from '../utils/parse.js'

const router = Router();

const ParamsSchema = z.object({
  search: z.string(),
  page: z.number({ coerce: true }).optional(),
  limit: z.number({ coerce: true }).optional(),
  orderField: z.enum(['pendingMints', 'name', 'symbol', 'deployTimestamp']).optional(),
  order: z.enum(['asc', 'desc']).optional()
})

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const {
    search,
    page = 1,
    limit = 10,
    orderField = 'deployTimestamp',
    order = 'asc'
  } = parse(ParamsSchema, req.query)
  const service = new AlkaneTokenService()
  const tokens = await service.searchAlkaneTokens(search, page, limit, { field: orderField, order });
  
  res.status(200).json({
    success: true,
    message: 'Successfully fetched tokens',
    data: tokens
  })
})

export default router; 
