import { z } from 'zod'
import { AutoInstrumentedClass } from '../instrumentation/AutoInstrumentedClass.js'
import { setAttributes } from '../instrumentation/instrumentation.js'
import { bigDecimal } from '../utils/big-decimal.js'
import { unisatFetch, unisatPagedFetch } from '../utils/unisat/unisatFetch.js'

const UnisatAlkaneBalanceSchema = z.object({
  alkaneid: z.string(),
  name: z.string(),
  symbol: z.string(),
  divisibility: z.number(),
  logo: z.string(),
  amount: z.string()
})

const UnisatBrc20BalanceSchema = z.object({
  ticker: z.string(),
  overallBalance: z.string(),
  decimal: z.number()
})

export interface AlkaneBalance {
  id: string
  name: string
  symbol: string
  logoUrl: string
  balance: string
}

export interface Brc20Balance {
  id: string
  name: string
  symbol: string
  balance: string
}

export interface PortfolioData {
  alkanes: AlkaneBalance[]
  brc20: Brc20Balance[]
}

export class PortfolioService extends AutoInstrumentedClass {
  async getAlkaneBalances(address: string): Promise<AlkaneBalance[]> {
    setAttributes({ address })
    const alkanes = await unisatPagedFetch(UnisatAlkaneBalanceSchema, `/address/${address}/alkanes/token-list`)
    setAttributes({ alkaneCount: alkanes.length })

    return alkanes.map((alkane) => ({
      id: alkane.alkaneid,
      name: alkane.name,
      symbol: alkane.symbol,
      logoUrl: alkane.logo,
      balance: toDecimalValue(alkane.amount, alkane.divisibility)
    }))
  }

  async getBrc20Balances(address: string): Promise<Brc20Balance[]> {
    setAttributes({ address })
    const brcs = await unisatPagedFetch(UnisatBrc20BalanceSchema, `/address/${address}/brc20/summary?tick_filter=24&exclude_zero=true`)
    const sixByteBrcs = await unisatPagedFetch(UnisatBrc20BalanceSchema, `/address/${address}/brc20-prog/summary`)
    const allBrcs = [...brcs, ...sixByteBrcs]
    setAttributes({ brcCount: allBrcs.length })

    return allBrcs.map(brc => ({
      id: brc.ticker,
      name: brc.ticker,
      symbol: brc.ticker,
      balance: toDecimalValue(brc.overallBalance, brc.decimal)
    }))
  }

  async getPortfolio(address: string): Promise<PortfolioData> {
    return {
      alkanes: await this.getAlkaneBalances(address),
      brc20: await this.getBrc20Balances(address)
    }
  }

  async hasAlkanes(address: string): Promise<boolean> {
    const { total } = await unisatFetch(z.object({ total: z.number() }), `/address/${address}/alkanes/token-list?start=0&limit=1`)
    return total > 0
  }

  async hasBrc20(address: string): Promise<boolean> {
    const { total: totalDefault } = await unisatFetch(z.object({ total: z.number() }), `/address/${address}/brc20/summary?tick_filter=24&exclude_zero=true&start=0&limit=1`)
    if (totalDefault > 0)
      return true

    const { total: totalSizeByte } = await unisatFetch(z.object({ total: z.number() }), `/address/${address}/brc20-prog/summary?start=0&limit=1`)
    return totalSizeByte > 0
  }
  
  async hasAnyTokens(address: string): Promise<boolean> {
    const hasAlkanes = await this.hasAlkanes(address)
    if (hasAlkanes)
      return true

    return await this.hasBrc20(address)
  }
}

function toDecimalValue(val: string | number, divisibility: number) {
  const divisor = new bigDecimal(10n ** BigInt(divisibility))
  return new bigDecimal(val).divide(divisor, divisibility).stripTrailingZero().getValue()
}
