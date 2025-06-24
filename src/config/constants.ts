import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config({ path: process.env.NODE_ENV === 'test' ? '.env.sample' : undefined })

export type BitcoinNetwork = typeof BITCOIN_NETWORK
export const BITCOIN_NETWORK = z.enum(['mainnet', 'signet', 'testnet'])
  .default('mainnet').parse(process.env.BITCOIN_NETWORK)

export const SANDSHREW_API_KEY = z.string({ message: "SANDSHREW_API_KEY is missing" })
  .parse(process.env.SANDSHREW_API_KEY)

const BitcoinRpcUrls = {
  'mainnet': `https://mainnet.sandshrew.io/v1/${SANDSHREW_API_KEY}`,
  'signet': `https://signet.sandshrew.io/v1/${SANDSHREW_API_KEY}`,
  'testnet': `https://testnet.sandshrew.io/v1/${SANDSHREW_API_KEY}`
}

export const BITCOIN_RPC_URL = BitcoinRpcUrls[BITCOIN_NETWORK]

export const MONGODB_URI = z.string({ message: "MONGODB_URI is missing" }).parse(process.env.MONGODB_URI)
export const DB_NAME = z.string().default('project-alkanes').parse(process.env.MONGODB_DB_NAME)

export const MempoolSyncCronJobOptions = {
  enabled: z.string().default("false").parse(process.env.MEMPOOL_SYNC_ENABLED) === 'true',
  cronExpression: z.string().default('*/30 * * * * *').parse(process.env.MEMPOOL_SYNC_CRON_EXPRESSION)
}
