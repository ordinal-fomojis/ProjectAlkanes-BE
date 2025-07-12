import { Payment } from "bitcoinjs-lib"
import { createAlkaneMintTransaction } from "./createAlkaneMintTransaction.js"
import { createPayment } from "./createPayment.js"
import { dustLimit } from "./utils/dustLimit.js"
import { AddressType } from "./utils/getAddressType.js"
import './utils/init-ecc.js'
import { randomKey } from "./utils/keys.js"
import { randomTransactionId } from "./utils/randomTransactionId.js"

interface GetMintTransactionSizeArgs {
  runescript: Payment
  outputAddressType: AddressType
}

export function getMintTransactionSize({ runescript, outputAddressType } : GetMintTransactionSizeArgs) {
  const outputAddress = createPayment({
    addressType: outputAddressType,
    publicKey: randomKey().publicKey
  }).address!
  
  return createAlkaneMintTransaction({
    runescript, outputAddress, key: randomKey(),
    utxo: { txid: randomTransactionId(), vout: 0, value: dustLimit(outputAddressType) }
  }).virtualSize()
}
