import { Verifier } from "bip322-js"

export function verifySignature(signature: string, message: string, address: string) {
  try {
    return Verifier.verifySignature(address, message, signature)
  } catch {
    return false
  }
}
