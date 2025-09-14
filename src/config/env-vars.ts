import { z } from 'zod'
import { parse } from '../utils/parse.js'
import { ENV } from './env.js'

const env = (key: string) => parse(z.string({ message: `${key} is missing` }), process.env[key])

// All environment variables are exported as getter functions to ensure they can be easily mocked in tests

export type BitcoinNetwork = ReturnType<typeof BITCOIN_NETWORK>
const _BITCOIN_NETWORK = parse(z.enum(['mainnet', 'signet', 'testnet'])
  .default('mainnet'), process.env.BITCOIN_NETWORK)
export const BITCOIN_NETWORK = () => _BITCOIN_NETWORK

const _UNISAT_API_KEY = env('UNISAT_API_KEY')
export const UNISAT_API_KEY = () => _UNISAT_API_KEY

const _MEMPOOL_API_URL = env('MEMPOOL_API_URL')
export const MEMPOOL_API_URL = () => _MEMPOOL_API_URL

const _SANDSHREW_API_KEY = env('SANDSHREW_API_KEY')
export const SANDSHREW_API_KEY = () => _SANDSHREW_API_KEY

const _MONGODB_URI = env('MONGODB_URI')
export const MONGODB_URI = () => _MONGODB_URI

const _MONGODB_DB_NAME = env('MONGODB_DB_NAME')
export const DB_NAME = () => _MONGODB_DB_NAME

const _RECEIVE_ADDRESS = env('RECEIVE_ADDRESS')
export const RECEIVE_ADDRESS = () => _RECEIVE_ADDRESS

const _MOCK_BTC = parse(z.enum(['true', 'false']).default('false'), process.env.MOCK_BTC) === 'true'
export const MOCK_BTC = () => _MOCK_BTC

const _ENCRYPTION_KEY = env('ENCRYPTION_KEY')
export const ENCRYPTION_KEY = () => _ENCRYPTION_KEY

const _INITIALISE_INDEXES = parse(z.enum(['true', 'false']).default('false'), process.env.INITIALISE_INDEXES) === 'true'
export const INITIALISE_INDEXES = () => _INITIALISE_INDEXES || ENV !== 'development'

// Ordiscan API Configuration
const _ORDISCAN_API_KEY = process.env.ORDISCAN_API_KEY || undefined
export const ORDISCAN_API_KEY = () => _ORDISCAN_API_KEY

const _ORDISCAN_API_URL = parse(z.string().default('https://api.ordiscan.com'), process.env.ORDISCAN_API_URL)
export const ORDISCAN_API_URL = () => _ORDISCAN_API_URL
