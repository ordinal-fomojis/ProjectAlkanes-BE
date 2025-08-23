import { Psbt, crypto, payments } from 'bitcoinjs-lib'
import { toXOnly } from 'bitcoinjs-lib/src/psbt/bip371.js'
import { describe, expect, it, vi } from 'vitest'
import { getRawTransactions } from '../../../src/utils/rpc/getRawTransactions.js'
import { createAlkaneUserTransaction } from '../../../src/utils/transaction/alkanes/createAlkaneUserTransaction.js'
import { createInput } from '../../../src/utils/transaction/createInput.js'
import { createPayment } from '../../../src/utils/transaction/createPayment.js'
import { createDummyTx } from '../../../src/utils/transaction/utils/calculateTransactionInputsAndFee.js'
import { AddressType } from '../../../src/utils/transaction/utils/getAddressType.js'
import '../../../src/utils/transaction/utils/init-ecc.js'
import { randomKey } from '../../../src/utils/transaction/utils/keys.js'
import { BTC_JS_NETWORK } from '../../../src/utils/transaction/utils/network.js'
import { validatePsbtWithReference } from '../../../src/utils/transaction/validatePsbtWithReference.js'
import Random from '../../test-utils/Random.js'
import { randomAddress } from '../../test-utils/btc-random.js'

vi.mock('../../../src/utils/rpc/getRawTransactions.js')

async function createTestPsbt(addressType: AddressType, key?: ReturnType<typeof randomKey>) {
  key ??= randomKey()
  const pubkey = key.publicKey.toString('hex')

  if (addressType === 'p2tr') {
    key = key.tweak(
      crypto.taggedHash('TapTweak', toXOnly(key.publicKey)),
    )
  }

  const paymentAddress = addressType === 'p2tr'
    ? payments.p2tr({ pubkey: toXOnly(key.publicKey), network: BTC_JS_NETWORK() }).address!
    : createPayment({ addressType, publicKey: key.publicKey }).address!

  const receiveAddress = createPayment({
    addressType, publicKey: randomKey().publicKey
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

  return { psbt, key }
}

describe('validatePsbtWithReference', () => {
  it.each(
    ['p2tr', 'p2pkh', 'p2wpkh', 'p2sh-p2wpkh'] as const
  )('should return true for identical PSBTs, where one is signed and the other not', async addressType => {
    const { psbt, key } = await createTestPsbt(addressType)
    const psbtHex = psbt.toHex()
    const psbt2 = Psbt.fromHex(psbtHex)

    psbt2.signAllInputs(key)
    psbt2.finalizeAllInputs()
    
    expect(psbtHex).not.toBe(psbt2.toHex())
    expect(validatePsbtWithReference(psbt, psbt2)).toBe(true)
  })

  it('should return true when two different transactions are created identically', async () => {
    const addressType = 'p2wpkh'
    const key = randomKey()
    const payment = createPayment({ addressType, publicKey: key.publicKey })
    const psbt1 = new Psbt()
    const psbt2 = new Psbt()
    
    const txid = Random.randomTransactionId()
    psbt1.addInput(await createInput({
      addressType, payment, publicKey: key.publicKey,
      txid, vout: 0, value: 5000
    }))
    psbt2.addInput(await createInput({
      addressType, payment, publicKey: key.publicKey,
      txid, vout: 0, value: 5000
    }))
    
    const address = randomAddress()
    psbt1.addOutput({ address, value: 50000 })
    psbt2.addOutput({ address, value: 50000 })
    
    expect(validatePsbtWithReference(psbt1, psbt2)).toBe(true)
  })

  it('should return false when PSBT has different number of outputs', async () => {
    const addressType = 'p2wpkh'
    const key = randomKey()
    const payment = createPayment({ addressType, publicKey: key.publicKey })
    const psbt1 = new Psbt()
    const psbt2 = new Psbt()
    
    const txid = Random.randomTransactionId()
    psbt1.addInput(await createInput({
      addressType, payment, publicKey: key.publicKey,
      txid, vout: 0, value: 5000
    }))
    psbt2.addInput(await createInput({
      addressType, payment, publicKey: key.publicKey,
      txid, vout: 0, value: 5000
    }))
    
    const address = randomAddress()
    psbt1.addOutput({ address, value: 50000 })
    psbt2.addOutput({ address, value: 50000 })
    psbt2.addOutput({ address, value: 50000 })
    
    expect(validatePsbtWithReference(psbt1, psbt2)).toBe(false)
  })

  it('should return false when PSBT has different number of inputs', async () => {
    const addressType = 'p2wpkh'
    const key = randomKey()
    const payment = createPayment({ addressType, publicKey: key.publicKey })
    const psbt1 = new Psbt()
    const psbt2 = new Psbt()
    
    const txid = Random.randomTransactionId()
    psbt1.addInput(await createInput({
      addressType, payment, publicKey: key.publicKey,
      txid, vout: 0, value: 5000
    }))
    psbt2.addInput(await createInput({
      addressType, payment, publicKey: key.publicKey,
      txid, vout: 0, value: 5000
    }))
    psbt2.addInput(await createInput({
      addressType, payment, publicKey: key.publicKey,
      txid, vout: 1, value: 5000
    }))

    const address = randomAddress()
    psbt1.addOutput({ address, value: 50000 })
    psbt2.addOutput({ address, value: 50000 })
    
    expect(validatePsbtWithReference(psbt1, psbt2)).toBe(false)
  })

  it('should return false when input transaction ids differ', async () => {
    const addressType = 'p2wpkh'
    const key = randomKey()
    const payment = createPayment({ addressType, publicKey: key.publicKey })
    const psbt1 = new Psbt()
    const psbt2 = new Psbt()
    
    psbt1.addInput(await createInput({
      addressType, payment, publicKey: key.publicKey,
      txid: Random.randomTransactionId(),
      vout: 0, value: 5000
    }))

    psbt2.addInput(await createInput({
      addressType, payment, publicKey: key.publicKey,
      txid: Random.randomTransactionId(),
      vout: 0, value: 5000
    }))
    
    const address = randomAddress()
    psbt1.addOutput({ address, value: 50000 })
    psbt2.addOutput({ address, value: 50000 })
    
    expect(validatePsbtWithReference(psbt1, psbt2)).toBe(false)
  })

  it('should return false when input indices differ', async () => {
    const addressType = 'p2wpkh'
    const key = randomKey()
    const payment = createPayment({ addressType, publicKey: key.publicKey })
    const psbt1 = new Psbt()
    const psbt2 = new Psbt()
    
    const txid = Random.randomTransactionId()
    psbt1.addInput(await createInput({
      addressType, payment, publicKey: key.publicKey,
      txid, vout: 0, value: 5000
    }))
    psbt2.addInput(await createInput({
      addressType, payment, publicKey: key.publicKey,
      txid, vout: 1, value: 5000
    }))
    
    const address = randomAddress()
    psbt1.addOutput({ address, value: 50000 })
    psbt2.addOutput({ address, value: 50000 })
    
    expect(validatePsbtWithReference(psbt1, psbt2)).toBe(false)
  })

  it('should return false when output values differ', async () => {
    const addressType = 'p2wpkh'
    const key = randomKey()
    const payment = createPayment({ addressType, publicKey: key.publicKey })
    const psbt1 = new Psbt()
    const psbt2 = new Psbt()
    
    const txid = Random.randomTransactionId()
    psbt1.addInput(await createInput({
      addressType, payment, publicKey: key.publicKey,
      txid, vout: 0, value: 5000
    }))
    psbt2.addInput(await createInput({
      addressType, payment, publicKey: key.publicKey,
      txid, vout: 0, value: 5000
    }))
    
    const address = randomAddress()
    psbt1.addOutput({ address, value: 50000 })
    psbt2.addOutput({ address, value: 60000 })
    
    expect(validatePsbtWithReference(psbt1, psbt2)).toBe(false)
  })

  it('should return false when output addresses differ', async () => {
    const addressType = 'p2wpkh'
    const key = randomKey()
    const payment = createPayment({ addressType, publicKey: key.publicKey })
    const psbt1 = new Psbt()
    const psbt2 = new Psbt()
    
    const txid = Random.randomTransactionId()
    psbt1.addInput(await createInput({
      addressType, payment, publicKey: key.publicKey,
      txid, vout: 0, value: 5000
    }))
    psbt2.addInput(await createInput({
      addressType, payment, publicKey: key.publicKey,
      txid, vout: 0, value: 5000
    }))
    
    psbt1.addOutput({ address: randomAddress(), value: 50000 })
    psbt2.addOutput({ address: randomAddress(), value: 50000 })
    
    expect(validatePsbtWithReference(psbt1, psbt2)).toBe(false)
  })
})
