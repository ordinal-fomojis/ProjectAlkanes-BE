import { AddressType } from "./getAddressType.js"

export function dustLimit(addressType: AddressType): number {
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
