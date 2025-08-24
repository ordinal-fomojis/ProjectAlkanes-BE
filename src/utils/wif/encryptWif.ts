import { subtle } from "node:crypto"
import { WifSigner } from "../transaction/utils/keys.js"
import { EncryptionKey } from "./encryptionKey.js"

export interface EncryptedWif {
  iv: string
  data: string
}

export async function encryptWif(wif: WifSigner): Promise<EncryptedWif> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await EncryptionKey()
  const data = Buffer.from(wif.toWIF(), 'utf-8')
  const encrypted = await subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, data)
  return {
    iv: Buffer.from(iv).toString('hex'),
    data: Buffer.from(encrypted).toString('hex')
  }
}
