import { subtle } from "node:crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ENCRYPTION_KEY } from "../../../src/config/env.js"
import { randomKey } from "../../../src/utils/transaction/utils/keys.js"
import { decryptWif } from "../../../src/utils/wif/decryptWif.js"
import { encryptWif } from "../../../src/utils/wif/encryptWif.js"

vi.mock("../../../src/config/env.js")

beforeEach(async () => {
  const encryptionKey = await subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ['encrypt'])
  const rawKey = Buffer.from(await subtle.exportKey("raw", encryptionKey)).toString('hex')
  vi.mocked(ENCRYPTION_KEY).mockReturnValue(rawKey)
})

describe('WIF Encryption', () => {
  it('should encrypt and decrypt a key', async () => {
    const key = randomKey()
    const encrypted = await encryptWif(key)
    const decrypted = await decryptWif(encrypted)
    expect(decrypted.toWIF()).toBe(key.toWIF())
  })
})
