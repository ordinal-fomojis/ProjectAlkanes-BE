import { config } from '@dotenvx/dotenvx'
import { z } from 'zod'
import { parse } from '../utils/parse.js'

config({
  path: process.env.NODE_ENV === 'test'
    ? '.env.sample'
    : process.env.NODE_ENV === 'production'
      ? '.env.production'
      : undefined,
  quiet: true
})

export type BitcoinNetwork = typeof BITCOIN_NETWORK
export const BITCOIN_NETWORK = parse(z.enum(['mainnet', 'signet', 'testnet'])
  .default('mainnet'), process.env.BITCOIN_NETWORK)

export const SANDSHREW_API_KEY = parse(
  z.string({ message: "SANDSHREW_API_KEY is missing" }), process.env.SANDSHREW_API_KEY)

export const ORDISCAN_API_KEY = parse(
  z.string({ message: "ORDISCAN_API_KEY is missing" }), process.env.ORDISCAN_API_KEY)

const BitcoinRpcUrls = {
  'mainnet': `https://mainnet.sandshrew.io/v1/${SANDSHREW_API_KEY}`,
  'signet': `https://signet.sandshrew.io/v1/${SANDSHREW_API_KEY}`,
  'testnet': `https://testnet.sandshrew.io/v1/${SANDSHREW_API_KEY}`
}

export const BITCOIN_RPC_URL = BitcoinRpcUrls[BITCOIN_NETWORK]

export const MONGODB_URI = parse(z.string({ message: "MONGODB_URI is missing" }), process.env.MONGODB_URI)
export const DB_NAME = parse(z.string().default('project-alkanes'), process.env.MONGODB_DB_NAME)

export const MempoolSyncCronJobOptions = {
  enabled: parse(z.string().default("false"), process.env.MEMPOOL_SYNC_ENABLED) === 'true',
  cronExpression: parse(z.string().default('*/30 * * * * *'), process.env.MEMPOOL_SYNC_CRON_EXPRESSION)
}

export const TokenSyncCronJobOptions = {
  enabled: parse(z.string().default("false"), process.env.TOKEN_SYNC_ENABLED) === 'true',
  cronExpression: parse(z.string().default('*/30 * * * * *'), process.env.TOKEN_SYNC_CRON_EXPRESSION)
}

export const MIN_FEE_RATE = 1
