import { address } from "bitcoinjs-lib"
import { UserError } from "./errors.js"
import getAddressType from "./transaction/utils/getAddressType.js"
import { BTC_JS_NETWORK } from "./transaction/utils/network.js"

class InvalidAddressError extends UserError {
  constructor(address: string) {
    super(`Invalid Bitcoin address: ${address}`);
    this.name = "InvalidAddressError";
  }
}

export function sanitizeAddress(address: string) {
  address = address.trim()
  const addressType = getAddressType(address)
  if (addressType === 'p2tr' || addressType === 'p2wpkh') {
    // Bech32 addresses are case insensitive
    address = address.toLowerCase()
  }

  if (!isValidAddress(address)) {
    throw new InvalidAddressError(address)
  }

  return address
}



function isValidAddress(a: string) {  
  try {
    address.toOutputScript(a, BTC_JS_NETWORK())
    return true
  } catch {
    return false
  }
}
