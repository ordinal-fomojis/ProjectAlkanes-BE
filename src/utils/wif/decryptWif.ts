import { subtle } from "node:crypto"
import { fromWIF } from "../transaction/utils/keys.js"
import { DecryptionKey } from "./encryptionKey.js"
import { EncryptedWif } from "./encryptWif.js"

export async function decryptWif(encryptedWif: EncryptedWif) {
  const key = await DecryptionKey()
  const iv = Buffer.from(encryptedWif.iv, 'hex')
  const data = Buffer.from(encryptedWif.data, 'hex')
  const decrypted = await subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, data)
  return fromWIF(Buffer.from(decrypted).toString('utf-8'));
}
