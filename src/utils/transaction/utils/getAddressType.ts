import { BITCOIN_NETWORK } from "../../../config/constants.js"

export class UnsupportedAddressType extends Error {
  constructor(public address: string) {
    super(`Your payment address is an unsupported address type.\nAddress: ${address}`)
  }

  truncatedAddress() {
    if (this.address.length < 14) return this.address
    return `${this.address.slice(0, 6)}…${this.address.slice(this.address.length - 6)}`
  }
}

const PREFIXES = {
  p2tr: BITCOIN_NETWORK === 'mainnet' ? 'bc1p' : 'tb1p',     // Taproot
  'p2sh-p2wpkh': BITCOIN_NETWORK === 'mainnet' ? '3' : '2',  // Nested Segwit
  p2wpkh: BITCOIN_NETWORK === 'mainnet' ? 'bc1q' : 'tb1q',   // Native Segwit
  p2pkh: BITCOIN_NETWORK === 'mainnet' ? '1' : 'm'           // Legacy
} as const

export type AddressType = keyof typeof PREFIXES

export default function getAddressType(address: string) {
  for (const [type, prefix] of Object.entries(PREFIXES)) {
    if (address.toLowerCase().trim().startsWith(prefix)) return type as AddressType
  }
  throw new UnsupportedAddressType(address)
}
