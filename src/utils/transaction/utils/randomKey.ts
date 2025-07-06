import * as ecc from '@bitcoinerlab/secp256k1'
import { Signer } from 'bitcoinjs-lib'
import { ECPairFactory } from 'ecpair'
import { BTC_JS_NETWORK } from './network.js'

const EC_PAIR = ECPairFactory(ecc);

export function randomKey() {
  const key = EC_PAIR.makeRandom({ network: BTC_JS_NETWORK })
  return {
    publicKey: Buffer.from(key.publicKey),
    network: key.network,
    sign: (hash, lowR) => Buffer.from(key.sign(hash, lowR)),
    signSchnorr: hash => Buffer.from(key.signSchnorr(hash)),
  } satisfies Signer
}
