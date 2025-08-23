import { crypto, payments } from "bitcoinjs-lib"
import { toXOnly } from "bitcoinjs-lib/src/psbt/bip371.js"
import { describe, expect, it, vi } from "vitest"
import { getRawTransactions } from "../../src/utils/rpc/getRawTransactions.js"
import { createAlkaneUserTransaction } from "../../src/utils/transaction/alkanes/createAlkaneUserTransaction.js"
import { createPayment } from "../../src/utils/transaction/createPayment.js"
import { NotEnoughFundsError } from "../../src/utils/transaction/NotEnoughFundsError.js"
import { createDummyTx } from "../../src/utils/transaction/utils/calculateTransactionInputsAndFee.js"
import { dustLimit } from "../../src/utils/transaction/utils/dustLimit.js"
import { randomKey } from "../../src/utils/transaction/utils/keys.js"
import { BTC_JS_NETWORK } from "../../src/utils/transaction/utils/network.js"
import { getAlkaneMintServiceFee } from "../../src/utils/transaction/utils/service-fee.js"
import Random from "../test-utils/Random.js"

vi.mock('../../src/utils/rpc/getRawTransactions.js')

describe("createAlkaneUserTransaction", () => {
  it.each([
    ['p2pkh', 'p2pkh'],
    ['p2pkh', 'p2sh-p2wpkh'],
    ['p2pkh', 'p2wpkh'],
    ['p2pkh', 'p2tr'],
    ['p2sh-p2wpkh', 'p2pkh'],
    ['p2sh-p2wpkh', 'p2sh-p2wpkh'],
    ['p2sh-p2wpkh', 'p2wpkh'],
    ['p2sh-p2wpkh', 'p2tr'],
    ['p2wpkh', 'p2pkh'],
    ['p2wpkh', 'p2sh-p2wpkh'],
    ['p2wpkh', 'p2wpkh'],
    ['p2wpkh', 'p2tr'],
    ['p2tr', 'p2pkh'],
    ['p2tr', 'p2sh-p2wpkh'],
    ['p2tr', 'p2wpkh'],
    ['p2tr', 'p2tr'],
  ] as const)('should succeed for when paying with %s and receiving to %s', async (paymentAddressType, receiveAddressType) => {
    let key = randomKey()
    const pubkey = key.publicKey.toString('hex')

    if (paymentAddressType === 'p2tr') {
      key = key.tweak(
        crypto.taggedHash('TapTweak', toXOnly(key.publicKey)),
      )
    }

    const paymentAddress = paymentAddressType === 'p2tr'
      ? payments.p2tr({ pubkey: toXOnly(key.publicKey), network: BTC_JS_NETWORK }).address!
      : createPayment({ addressType: paymentAddressType, publicKey: key.publicKey }).address!

    const receiveAddress = createPayment({
      addressType: receiveAddressType, publicKey: randomKey().publicKey
    }).address!

    const txValue = 1000000
    const dummyTx = await createDummyTx(paymentAddress, txValue)
    vi.mocked(getRawTransactions).mockResolvedValue([{
      success: true,
      response: dummyTx.toHex(),
      params: [dummyTx.getId()]
    }])
    
    const utxos = [{
      txid: dummyTx.getId(),
      vout: 0,
      value: txValue
    }]

    const { psbt } = await createAlkaneUserTransaction({
      feeRate: 10, alkaneId: "2:0", receiveAddress, paymentAddress,
      paymentPubkey: pubkey, mintCount: 10, utxos
    })

    psbt.signAllInputs(key)
    psbt.finalizeAllInputs()

    psbt.extractTransaction()
  })

  it('should throw an error if there are not enough funds', async () => {
    const key = randomKey()
    const address = createPayment({ addressType: 'p2wpkh', publicKey: key.publicKey }).address!

    const txValue = 1000
    const utxos = [{
      txid: Random.randomTransactionId(),
      vout: 0,
      value: txValue
    }]

    await expect(createAlkaneUserTransaction({
      feeRate: 10, alkaneId: "2:0", receiveAddress: address, paymentAddress: address,
      paymentPubkey: key.publicKey.toString('hex'), mintCount: 10, utxos
    })).rejects.toThrow(NotEnoughFundsError)
  })
  
  it('should create tx with correct fee rate', async () => {
    const key = randomKey()
    const address = createPayment({ addressType: 'p2wpkh', publicKey: key.publicKey }).address!

    const txValue = 100000
    const utxos = [{
      txid: Random.randomTransactionId(),
      vout: 0,
      value: txValue
    }]

    const { psbt } = await createAlkaneUserTransaction({
      feeRate: 10, alkaneId: "2:0", receiveAddress: address, paymentAddress: address,
      paymentPubkey: key.publicKey.toString('hex'), mintCount: 10, utxos
    })

    psbt.signAllInputs(key)
    psbt.finalizeAllInputs()

    expect(psbt.getFeeRate()).toEqual(expect.closeTo(10, 0.01))
  })

  it.each([
    [1, 1],
    [2, 1],
    [24, 1],
    [25, 2],
    [40, 2],
    [100, 5]
  ])('it should create %d outputs for %d mints', async (mintCount, expectedOutputs) => {
    const key = randomKey()
    const address = createPayment({ addressType: 'p2wpkh', publicKey: key.publicKey }).address!

    const txValue = 10000000
    const utxos = [{
      txid: Random.randomTransactionId(),
      vout: 0,
      value: txValue
    }]

    const { psbt } = await createAlkaneUserTransaction({
      feeRate: 10, alkaneId: "2:0", receiveAddress: address, paymentAddress: address,
      paymentPubkey: key.publicKey.toString('hex'), mintCount, utxos
    })

    psbt.signAllInputs(key)
    psbt.finalizeAllInputs()

    const tx = psbt.extractTransaction()
    const serviceFeeHasOutput = getAlkaneMintServiceFee(mintCount) >= dustLimit('p2wpkh')
    // subtracting change, service fee, and op return outputs
    expect(tx.outs.length - (serviceFeeHasOutput ? 3 : 2)).toBe(expectedOutputs)
  })
})
