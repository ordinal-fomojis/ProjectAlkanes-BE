import { subtle, webcrypto } from "node:crypto"
import { ENCRYPTION_KEY } from "../../config/env-vars.js"

let encryptionKey: webcrypto.CryptoKey | null = null
let decryptionKey: webcrypto.CryptoKey | null = null

export const EncryptionKey = async () => encryptionKey ??= await loadEncryptionKey()
export const DecryptionKey = async () => decryptionKey ??= await loadDecryptionKey()

async function loadEncryptionKey() {
  return await subtle.importKey('raw', Buffer.from(ENCRYPTION_KEY(), 'hex'), "AES-GCM", false, ["encrypt"]);
}

async function loadDecryptionKey() {
  return await subtle.importKey('raw', Buffer.from(ENCRYPTION_KEY(), 'hex'), "AES-GCM", false, ["decrypt"]);
}
