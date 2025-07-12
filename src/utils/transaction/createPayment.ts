import { payments } from "bitcoinjs-lib"
import { toXOnly } from "bitcoinjs-lib/src/psbt/bip371.js"
import { AddressType, UnsupportedAddressType } from "./utils/getAddressType.js"
import { BTC_JS_NETWORK } from "./utils/network.js"

interface CreatePaymentArgs {
  addressType: AddressType
  publicKey: Buffer
  validateAddress?: string
}

export function createPayment({ addressType, publicKey, validateAddress } : CreatePaymentArgs) {
  function getPayment() {
    const network = BTC_JS_NETWORK

    if (addressType === 'p2wpkh') {
      return payments.p2wpkh({ pubkey: publicKey, network })
    } else if (addressType === 'p2sh-p2wpkh') {
      const payment = payments.p2wpkh({ pubkey: publicKey, network })
      return payments.p2sh({ redeem: payment, network })
    } else if (addressType === 'p2tr') {
      return payments.p2tr({ internalPubkey: toXOnly(publicKey), network })
    } else {
      return payments.p2pkh({ pubkey: publicKey, network })
    }
  }

  const payment = getPayment()
  if (validateAddress != null && payment.address !== validateAddress) {
    throw new UnsupportedAddressType(validateAddress)
  }
  return payment
}
