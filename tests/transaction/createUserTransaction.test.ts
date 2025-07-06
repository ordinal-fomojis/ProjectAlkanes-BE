import { payments, Psbt } from "bitcoinjs-lib"
import { toXOnly } from "bitcoinjs-lib/src/psbt/bip371.js"
import { describe, expect, it, vi } from "vitest"
import { getRawTransactions } from "../../src/utils/rpc/getRawTransactions.js"
import { createInput } from "../../src/utils/transaction/createInput.js"
import { createPayment } from "../../src/utils/transaction/createPayment.js"
import { createUserTransaction } from "../../src/utils/transaction/createUserTransaction.js"
import { randomKey } from "../../src/utils/transaction/utils/keys.js"
import { BTC_JS_NETWORK } from "../../src/utils/transaction/utils/network.js"
import Random from "../test-utils/Random.js"

vi.mock('../../src/utils/rpc/getRawTransactions.js')

describe("createUserTransaction", () => {
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
    const key = randomKey()
    const paymentAddress = createPayment({ addressType: paymentAddressType, publicKey: key.publicKey }).address!

    const receiverAddress = createPayment({
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

    await expect(createUserTransaction({
      feeRate: 10, alkaneId: "2:0", receiverAddress, paymentAddress,
      paymentPubkey: key.publicKey.toString('hex'), mintCount: 10, utxos
    })).resolves.toBeDefined()
  })
})

async function createDummyTx(address: string, value: number) {
  const psbt = new Psbt({ network: BTC_JS_NETWORK });
  const key = randomKey();
  const payment = payments.p2tr({ pubkey: toXOnly(key.publicKey), network: BTC_JS_NETWORK });
  psbt.addInput(await createInput({
    addressType: 'p2tr',
    txid: Random.randomTransactionId(),
    vout: 0,
    publicKey: key.publicKey,
    value: value + 10000,
    payment
  }));
  psbt.addOutput({ address, value })
  psbt.signAllInputs(key)
  psbt.finalizeAllInputs()
  return psbt.extractTransaction()
}
