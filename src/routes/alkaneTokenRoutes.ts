import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { AlkaneToken, AlkaneTokenService } from '../services/AlkaneTokenService.js';
import { parse } from '../utils/parse.js';

const router = Router();

const ParamsSchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
  orderBy: z.enum(['pendingMints', 'deployTimestamp', 'percentageMinted', 'mintCountCap', 'currentMintCount', 'preminedPercentage']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  mintable: z.enum(['true', 'false']).optional(),
  mintedOut: z.enum(['true', 'false']).optional(),
  noPremine: z.enum(['true', 'false']).optional()
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
    noPremine = null
  } = parse(ParamsSchema, req.query)
  const service = new AlkaneTokenService()
  const tokens = await service.searchAlkaneTokens({
    searchTerm: search ?? null, page, pageSize, order: { field: orderBy, order },
    mintable: typeof mintable === 'string' ? mintable === 'true' : null,
    mintedOut: typeof mintedOut === 'string' ? mintedOut === 'true' : null,
    noPremine: typeof noPremine === 'string' ? noPremine === 'true' : null
  });

  res.status(200).json({
    success: true,
    message: 'Successfully fetched tokens',
    data: tokens.map(tokenToResponse)
  })
})

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params
  if (id == null) {
    res.status(400).json({
      success: false,
      message: 'Missing token ID'
    })
    return
  }

  const service = new AlkaneTokenService()
  const token = await service.getAlkaneById(id)
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

function tokenToResponse(token: AlkaneToken) {
  return {
    alkaneId: token.alkaneId,
    name: token.name,
    symbol: token.symbol,
    logoUrl: token.logoUrl,
    deployTxid: token.deployTxid,
    preminedSupply: token.preminedSupply,
    amountPerMint: token.amountPerMint,
    mintCountCap: token.mintCountCap,
    mintable: token.mintable,
    maxSupply: token.maxSupply,
    percentageMinted: token.percentageMinted,
    pendingMints: token.pendingMints,
    currentSupply: token.currentSupply,
    currentMintCount: token.currentMintCount,
    mintedOut: token.mintedOut,
    deployTimestamp: token.deployTimestamp.toISOString(),
    preminedPercentage: token.preminedPercentage
  }
}

export default router; 
