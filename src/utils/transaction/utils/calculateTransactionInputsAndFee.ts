// Takes a generic unsignable tx (e.g. a user tx) and a list of UTXO's and finds the best UTXO's to use.
// It then adds these as inputs and adds a change output to satisfy the required fee rate.
// This is done by creating a copy of the transaction with equivalent dummy inputs that are signable with a dummy key.

import { Psbt, Signer, crypto, payments } from "bitcoinjs-lib"
import { toXOnly } from "bitcoinjs-lib/src/psbt/bip371.js"
import { NotEnoughFundsError } from "../NotEnoughFundsError.js"
import { createInput } from "../createInput.js"
import { createPayment } from "../createPayment.js"
import { Utxo } from "../getUtxos.js"
import { dustLimit } from "./dustLimit.js"
import getAddressType from "./getAddressType.js"
import { randomKey } from "./keys.js"
import { BTC_JS_NETWORK } from "./network.js"
import { randomTransactionId } from "./randomTransactionId.js"

interface CalculateTransactionInputsAndFee {
  psbt: Psbt
  utxos: Utxo[]
  feeRate: number
  paymentAddress: string
  paymentPubkey: string
}

export async function calculateTransactionInputsAndFee({
  psbt, utxos, feeRate, paymentAddress, paymentPubkey
} : CalculateTransactionInputsAndFee) {
  const addressType = getAddressType(paymentAddress)
  const publicKey = Buffer.from(paymentPubkey, 'hex')
  const payment = createPayment({ addressType, publicKey, validateAddress: paymentAddress })
  
  let dummyKey = randomKey()
  const dummyPayment = createPayment({ addressType, publicKey: dummyKey.publicKey })

  if (addressType === 'p2tr') {
    dummyKey = dummyKey.tweak(
      crypto.taggedHash('TapTweak', toXOnly(dummyKey.publicKey)),
    )
  }

  const totalOutputValue = psbt.txOutputs.reduce((sum, output) => sum + output.value, 0)
  let inputValue = 0
  let virtualSize = 0
  const dummyPsbt = psbt.clone()
  while (inputValue < (totalOutputValue + Math.ceil(virtualSize * feeRate))) {
    const utxo = utxos.pop()
    if (utxo == null) {
      throw new NotEnoughFundsError(totalOutputValue + Math.ceil(virtualSize * feeRate))
    }

    inputValue += utxo.value
    psbt.addInput(await createInput({
      addressType,
      txid: utxo.txid,
      vout: utxo.vout,
      publicKey,
      value: utxo.value,
      payment
    }))

    dummyPsbt.addInput(await createInput({
      addressType,
      txid: utxo.txid,
      vout: utxo.vout,
      publicKey: dummyKey.publicKey,
      value: utxo.value,
      payment: dummyPayment,
      dummyInputTx: addressType === 'p2pkh' ? await createDummyTx(dummyPayment.address!, utxo.value) : undefined
    }))
    
    const change = inputValue - (totalOutputValue + Math.ceil(virtualSize * feeRate))
    if (change >= 0) {
      virtualSize = getVirtualSize(dummyPsbt, change, paymentAddress, dummyKey)
    }
  }

  const change = inputValue - (totalOutputValue + Math.ceil(virtualSize * feeRate))
  if (change > dustLimit(addressType)) {
    psbt.addOutput({
      address: paymentAddress,
      value: change
    })
  }

  return { networkFee: Math.ceil(virtualSize * feeRate) }
}

function getVirtualSize(psbt: Psbt, change: number, changeAddress: string, key: Signer) {
  const clone = psbt.clone()

  if (change > dustLimit(getAddressType(changeAddress))) {
    clone.addOutput({
      address: changeAddress,
      value: change
    })
  }

  clone.signAllInputs(key)
  clone.finalizeAllInputs()
  return clone.extractTransaction().virtualSize()
}

export async function createDummyTx(address: string, value: number) {
  const psbt = new Psbt({ network: BTC_JS_NETWORK });
  const key = randomKey();
  const payment = payments.p2tr({ pubkey: toXOnly(key.publicKey), network: BTC_JS_NETWORK });
  psbt.addInput(await createInput({
    addressType: 'p2tr',
    txid: randomTransactionId(),
    vout: 0,
    publicKey: key.publicKey,
    value: value + 10000,
    payment
  }));
  psbt.addOutput({ address, value });
  psbt.signAllInputs(key);
  psbt.finalizeAllInputs();
  return psbt.extractTransaction();
}
