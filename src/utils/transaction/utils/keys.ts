import * as ecc from '@bitcoinerlab/secp256k1'
import { Signer } from 'bitcoinjs-lib'
import { ECPairFactory, ECPairInterface } from 'ecpair'
import { BTC_JS_NETWORK } from './network.js'

const EC_PAIR = ECPairFactory(ecc);

export function randomKey() {
  return toSigner(EC_PAIR.makeRandom({ network: BTC_JS_NETWORK }))
}

export function fromWIF(wif: string) {
  const key = EC_PAIR.fromWIF(wif, BTC_JS_NETWORK)
  return toSigner(key)
}

function toSigner(key: ECPairInterface) {
  const signer = {
    publicKey: Buffer.from(key.publicKey),
    network: key.network,
    sign: (hash, lowR) => Buffer.from(key.sign(hash, lowR)),
    signSchnorr: hash => Buffer.from(key.signSchnorr(hash)),
  } satisfies Signer
  return { ...signer, toWIF: () => key.toWIF(), tweak: (t: Uint8Array) => toSigner(key.tweak(t)) }
}
