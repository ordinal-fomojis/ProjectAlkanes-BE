import { Request, Response, Router } from 'express'
import { z } from 'zod'
import { AlkaneTokenService } from '../services/AlkaneTokenService.js'
import { parse } from '../utils/parse.js'

const router = Router();

const ParamsSchema = z.object({
  search: z.string(),
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
  orderBy: z.enum(['pendingMints', 'deployTimestamp', 'percentageMinted', 'mintCountCap', 'currentMintCount', 'preminedPercentage']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  mintable: z.enum(['true', 'false']).optional(),
  mintedOut: z.enum(['true', 'false']).optional(),
  noPremine: z.enum(['true', 'false']).optional()
})

const UNSYNCED_FACTORY_CLONE_ID = "UNKNOWN"

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
    searchTerm: search, page, pageSize, order: { field: orderBy, order },
    mintable: typeof mintable === 'string' ? mintable === 'true' : null,
    mintedOut: typeof mintedOut === 'string' ? mintedOut === 'true' : null,
    noPremine: typeof noPremine === 'string' ? noPremine === 'true' : null
  });
  
  const tokenDetails = tokens.map(token => ({
    alkaneId: token.alkaneId,
    name: token.name,
    symbol: token.symbol,
    logoUrl: token.logoUrl,
    deployTxid: token.deployTxid,
    preminedSupply: token.preminedSupply,
    amountPerMint: token.amountPerMint,
    mintCountCap: token.mintCountCap,
    mintable: token.mintable ?? false,
    maxSupply: token.maxSupply,
    percentageMinted: token.percentageMinted,
    pendingMints: token.pendingMints ?? 0,
    currentSupply: token.currentSupply,
    currentMintCount: token.currentMintCount,
    mintedOut: token.mintedOut,
    deployTimestamp: token.deployTimestamp?.toISOString() ?? null,
    clonedFrom: token.clonedFrom === UNSYNCED_FACTORY_CLONE_ID ? null : token.clonedFrom,
    preminedPercentage: token.preminedPercentage ?? 0
  }))

  res.status(200).json({
    success: true,
    message: 'Successfully fetched tokens',
    data: tokenDetails
  })
})

export default router; 
