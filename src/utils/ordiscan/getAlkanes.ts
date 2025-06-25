import z from "zod"
import { throttledPromiseAllSettled } from "../throttledPromise.js"
import { ordiscanFetch } from "./ordiscanFetch.js"

const BaseAlkanesSchema = z.object({
  id: z.string(),
  name: z.string(),
  symbol: z.string(),
  logo_url: z.string(),
  premined_supply: z.string(),
  amount_per_mint: z.string(),
  mint_count_cap: z.string(),
  deploy_txid: z.string(),
  deploy_timestamp: z.string()
})

const FullAlkanesSchema = BaseAlkanesSchema.extend({
  current_supply: z.string(),
  current_mint_count: z.string()
})

export async function getAlkaneTokens(alkaneIds: string[]) {
  await throttledPromiseAllSettled(alkaneIds.map(() => async () => {
    const start = performance.now()
    const result = await ordiscanFetch(FullAlkanesSchema, `alkane/${alkaneIds}`)
    const duration = performance.now() - start
    // Throttle to 100 requests per second
    await new Promise(r => setTimeout(r, 10 - duration))
    return result
  }))
}

export async function getAlkaneIdsAfterTimestamp(minTimestamp: Date) {
  const alkanes: string[] = []
  let page = 1
  while (true) {
    const result = await getPagedAlkaneIds(page)
    if (result.length === 0) {
      return alkanes
    }

    for (const { alkaneId, timestamp } of result) {
      if (timestamp >= minTimestamp) {
        alkanes.push(alkaneId)
      } else {
        return alkanes
      }
    }
    page++
  }
}

async function getPagedAlkaneIds(page: number) {
  return (await ordiscanFetch(z.array(BaseAlkanesSchema), 'alkanes', {
    sort: 'newest',
    type: 'TOKEN',
    page: page.toString()
  })).map(a => ({ alkaneId: a.id, timestamp: new Date(a.deploy_timestamp) }))
}
