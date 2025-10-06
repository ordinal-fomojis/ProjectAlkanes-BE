import { AddressType } from "./getAddressType.js"

function dustLimitNum(addressType: AddressType) {
  switch (addressType) {
    case 'p2wpkh':
      return 294
    case 'p2sh-p2wpkh':
      return 540
    case 'p2tr':
      return 330
    case 'p2pkh':
      return 546
  }
}

export const dustLimit = (addressType: AddressType) => BigInt(dustLimitNum(addressType))
