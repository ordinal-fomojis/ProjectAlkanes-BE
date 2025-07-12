import { Network } from "bitcoinjs-lib"

declare module 'ecpair' {
  interface ECPairOptions {
    compressed?: boolean
    network?: Network
  }

  interface ECPairAPI {
    fromWIF(wifString: string, network?: Network | Network[]): ECPairInterface
    makeRandom(options?: ECPairOptions): ECPairInterface
  }

  interface Signer {
    publicKey: Uint8Array
    network?: Network
    sign(hash: Uint8Array, lowR?: boolean): Uint8Array
  }

  interface ECPairInterface extends Signer {
    compressed: boolean
    network: Network
    lowR: boolean
    privateKey?: Uint8Array
    toWIF(): string
    tweak(t: Uint8Array): ECPairInterface
    verify(hash: Uint8Array, signature: Uint8Array): boolean
    verifySchnorr(hash: Uint8Array, signature: Uint8Array): boolean
    signSchnorr(hash: Uint8Array): Uint8Array
  }

  export declare function ECPairFactory(ecc: TinySecp256k1Interface): ECPairAPI
}
