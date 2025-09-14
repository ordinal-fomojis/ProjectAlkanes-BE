import { config } from '@dotenvx/dotenvx'
import z from 'zod'
import { parse } from '../utils/parse.js'

export const ENV = parse(z.enum(['production', 'development', 'test']).default('development'), process.env.NODE_ENV)

config({
  path: ENV === 'test'
    ? '.env.sample'
    : process.env.DOTENV_PATH,
  quiet: true
})
