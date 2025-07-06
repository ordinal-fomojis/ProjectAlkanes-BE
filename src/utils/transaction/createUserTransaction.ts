import { crypto, payments, Psbt, Signer } from "bitcoinjs-lib"
import { toXOnly } from "bitcoinjs-lib/src/psbt/bip371.js"
import { MAX_UNCONFIRMED_DESCENDANT_TXNS, MIN_FEE_RATE } from "../../config/constants.js"
import { createInput } from "./createInput.js"
import { createPayment } from "./createPayment.js"
import { getMintTransactionSize } from "./getMintTransactionSize.js"
import { Utxo } from "./getUtxos.js"
import { createScriptForAlkaneMint } from "./protostone/createRunestoneForAlkaneMint.js"
import { dustLimit } from "./utils/dustLimit.js"
import getAddressType from "./utils/getAddressType.js"
import { getServiceFee } from "./utils/getServiceFee.js"
import { randomKey } from "./utils/keys.js"
import { BTC_JS_NETWORK } from "./utils/network.js"
import { randomTransactionId } from "./utils/randomTransactionId.js"

export class NotEnoughFundsError extends Error {
  constructor(public cost: number) {
    super(`Not enough funds to cover cost of ${cost} satoshis`)
  }
}

interface CreateUserTransactionArgs {
  feeRate: number
  paymentAddress: string
  paymentPubkey: string
  receiverAddress: string
  alkaneId: string
  mintCount: number
  utxos: Utxo[]
}

export async function createUserTransaction({
  feeRate, alkaneId, receiverAddress, mintCount, utxos, paymentAddress, paymentPubkey
} : CreateUserTransactionArgs) {
  feeRate = Math.max(feeRate, MIN_FEE_RATE)
  const internalKey = randomKey()
  const internalPubKey = toXOnly(internalKey.publicKey)
  const internalPayment = payments.p2tr({ pubkey: internalPubKey, network: BTC_JS_NETWORK })
  
  const addressType = getAddressType(receiverAddress)

  const runescript = createScriptForAlkaneMint(alkaneId)
  const mintTxSize = getMintTransactionSize({ runescript, outputAddressType: addressType })
  const feePerMint = Math.ceil(feeRate * mintTxSize)
  const txnsPerGroup = MAX_UNCONFIRMED_DESCENDANT_TXNS
  const txnsInLastGroup = (mintCount - 1) % MAX_UNCONFIRMED_DESCENDANT_TXNS

  const outputValue = dustLimit(addressType)
  const serviceFee = getServiceFee(mintCount)

  const psbt = new Psbt({ network: BTC_JS_NETWORK })
  psbt.addOutputs(Array.from({ length: Math.floor((mintCount - 1) / txnsPerGroup) }, () => ({
    script: internalPayment.output!,
    value: outputValue + txnsPerGroup * feePerMint
  })))

  if (txnsInLastGroup > 0) {
    psbt.addOutput({
      script: internalPayment.output!,
      value: outputValue + txnsInLastGroup * feePerMint
    })
  }

  if (serviceFee > dustLimit('p2tr')) {
    psbt.addOutput({
      address: receiverAddress,
      value: serviceFee
    })
  }

  psbt.addOutput({
    script: runescript.output!,
    value: 0
  })

  await addInputsAndCalculateFee({
    psbt, utxos, feeRate, paymentAddress, paymentPubkey
  })

  return { psbt, internalKey }
}

interface AddInputsAndCalculateFeeArgs {
  psbt: Psbt
  utxos: Utxo[]
  feeRate: number
  paymentAddress: string
  paymentPubkey: string
}

async function addInputsAndCalculateFee({
  psbt, utxos, feeRate, paymentAddress, paymentPubkey
} : AddInputsAndCalculateFeeArgs) {
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
  while (inputValue < (totalOutputValue + virtualSize * feeRate)) {
    const utxo = utxos.pop()
    if (utxo == null) {
      throw new NotEnoughFundsError(totalOutputValue + virtualSize * feeRate)
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

    virtualSize = getVirtualSize(dummyPsbt, paymentAddress, dummyKey)
  }

  const change = inputValue - (totalOutputValue + virtualSize * feeRate)
  if (change > dustLimit(addressType)) {
    psbt.addOutput({
      address: paymentAddress,
      value: change
    })
  }
}

function getVirtualSize(psbt: Psbt, changeAddress: string, key: Signer) {
  const clone = psbt.clone()

  clone.addOutput({
    address: changeAddress,
    value: 0
  })

  clone.signAllInputs(key)
  clone.finalizeAllInputs()
  return clone.extractTransaction().virtualSize()
}

async function createDummyTx(address: string, value: number) {
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
