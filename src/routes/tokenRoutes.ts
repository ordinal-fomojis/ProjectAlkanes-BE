import { Request, Response, Router } from 'express'
import { bigDecimal } from 'js-big-decimal'
import { z } from 'zod'
import { AlkaneTokenService } from '../services/AlkaneTokenService.js'
import { parse } from '../utils/parse.js'

const router = Router();

const ParamsSchema = z.object({
  search: z.string(),
  page: z.number({ coerce: true }).optional(),
  limit: z.number({ coerce: true }).optional(),
  orderBy: z.enum(['pendingMints', 'name', 'symbol', 'deployTimestamp', 'percentageMinted']).optional(),
  order: z.enum(['asc', 'desc']).optional()
})

const DIVISOR = new bigDecimal(100_000_000)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const {
    search,
    page = 1,
    limit = 10,
    orderBy = 'deployTimestamp',
    order = 'asc'
  } = parse(ParamsSchema, req.query)
  const service = new AlkaneTokenService()
  const tokens = await service.searchAlkaneTokens(search, page, limit, { field: orderBy, order });
  
  const tokenDetails = tokens.map(token => {
    const preminedSupply = toAlkane(token.preminedSupply)
    const amountPerMint = token.amountPerMint == null ? null : toAlkane(token.amountPerMint)
    const mintCountCap = token.mintCountCap == null ? null : new bigDecimal(token.mintCountCap)
    const mintable = token.amountPerMint != null && token.mintCountCap != null
    const maxSupply = mintCountCap == null ? null
      : (amountPerMint == null ? preminedSupply : preminedSupply.add(amountPerMint.multiply(mintCountCap)))
    const percentageMinted = mintCountCap == null || token.mintCountCap === 0 ? null
      : new bigDecimal(100 * token.currentMintCount).divide(mintCountCap)

    return {
      alkaneId: token.alkaneId,
      name: token.name,
      symbol: token.symbol,
      logoUrl: token.logoUrl,
      deployTxid: token.deployTxid,
      deployTimestamp: token.deployTimestamp?.toISOString() ?? null,
      preminedSupply: preminedSupply.stripTrailingZero().getValue(),
      amountPerMint: amountPerMint?.stripTrailingZero().getValue() ?? null,
      mintCountCap: mintCountCap?.stripTrailingZero().getValue() ?? null,
      mintable,
      maxSupply: maxSupply?.stripTrailingZero().getValue() ?? null,
      percentageMinted: percentageMinted == null ? null : parseFloat(percentageMinted.getValue()),
      pendingMints: token.pendingMints ?? 0,
      currentSupply: toAlkane(token.currentSupply).stripTrailingZero().getValue(),
      currentMintCount: token.currentMintCount
    }
  })

  res.status(200).json({
    success: true,
    message: 'Successfully fetched tokens',
    data: tokenDetails
  })
})

function toAlkane(val: string | number) {
  return new bigDecimal(val).divide(DIVISOR, 8)
}

export default router; 
