import { createPayment } from "../../src/utils/transaction/createPayment.js"
import { AddressType } from "../../src/utils/transaction/utils/getAddressType.js"
import "../../src/utils/transaction/utils/init-ecc.js"
import { randomKey } from "../../src/utils/transaction/utils/keys.js"

export function randomPayment(addressType: AddressType = 'p2tr') {
  const keyPair = randomKey()
  return createPayment({ addressType, publicKey: keyPair.publicKey })
}


export function randomAddress(type: AddressType = 'p2tr') {
  return randomPayment(type).address!
}
