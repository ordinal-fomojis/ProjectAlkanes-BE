import { BITCOIN_NETWORK } from "../../../config/constants.js"

const PREFIXES = {
  p2tr: BITCOIN_NETWORK === 'mainnet' ? 'bc1p' : 'tb1p',     // Taproot
  'p2sh-p2wpkh': BITCOIN_NETWORK === 'mainnet' ? '3' : '2',  // Nested Segwit
  p2wpkh: BITCOIN_NETWORK === 'mainnet' ? 'bc1q' : 'tb1q',   // Native Segwit
  p2pkh: BITCOIN_NETWORK === 'mainnet' ? '1' : 'm'           // Legacy
} as const

export type AddressType = keyof typeof PREFIXES

export default function getAddressType(address: string): AddressType | null {
  for (const [type, prefix] of Object.entries(PREFIXES)) {
    if (address.startsWith(prefix)) return type as AddressType
  }
  return null
}
