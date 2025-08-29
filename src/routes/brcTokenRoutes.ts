import { Request, Response, Router } from 'express'
import { z } from 'zod'
import { BrcToken, BrcTokenService } from '../services/BrcTokenService.js'
import { parse } from '../utils/parse.js'

const router = Router();

const ParamsSchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
  orderBy: z.enum(['deployTimestamp', 'percentageMinted', 'currentMintCount', 'holdersCount']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  mintable: z.enum(['true', 'false']).optional(),
  mintedOut: z.enum(['true', 'false']).optional(),
  tickerLength: z.coerce.number().optional()
})

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const {
    search,
    page = 1,
    pageSize = 20,
    orderBy = 'deployTimestamp',
    order = 'asc',
    mintable = null,
    mintedOut = null,
    tickerLength = null
  } = parse(ParamsSchema, req.query)
  const service = new BrcTokenService()
  const tokens = await service.searchBrcTokens({
    searchTerm: search ?? null, page, pageSize, order: { field: orderBy, order },
    mintable: typeof mintable === 'string' ? mintable === 'true' : null,
    mintedOut: typeof mintedOut === 'string' ? mintedOut === 'true' : null,
    tickerLength
  });

  res.status(200).json({
    success: true,
    message: 'Successfully fetched tokens',
    data: tokens.map(tokenToResponse)
  })
})

router.get('/:ticker', async (req: Request, res: Response): Promise<void> => {
  const { ticker } = req.params
  if (ticker == null) {
    res.status(400).json({
      success: false,
      message: 'Missing token ticker'
    })
    return
  }

  const service = new BrcTokenService()
  const token = await service.getBrcByTicker(ticker)
  if (token == null) {
    res.status(404).json({
      success: false,
      message: 'Token not found'
    })
    return
  }
  res.status(200).json({
    success: true,
    message: 'Successfully fetched token',
    data: tokenToResponse(token)
  })
})

function tokenToResponse(token: BrcToken) {
  return {
    ticker: token.ticker,
    minted: token.minted,
    decimal: token.decimal,
    currentMintCount: token.currentMintCount,
    deployTimestamp: token.deployTimestamp.toISOString(),
    holdersCount: token.holdersCount,
    limit: token.limit,
    max: token.max,
    mintable: token.mintable,
    mintedOut: token.mintedOut,
    percentageMinted: token.percentageMinted,
    selfMint: token.selfMint
  }
}

export default router; 
