import { Psbt } from "bitcoinjs-lib"

export function validatePsbtWithReference(signed: Psbt, unsigned: Psbt) {
  // Both Psbt's must have the same inputs and outputs
  if (signed.txInputs.length !== unsigned.txInputs.length ||
      signed.txOutputs.length !== unsigned.txOutputs.length) {
    return false
  }

  for (let i = 0; i < signed.txInputs.length; i++) {
    const signedInput = signed.txInputs[i]
    const unsignedInput = unsigned.txInputs[i]
    if (signedInput == null || unsignedInput == null) return false

    if (Buffer.from(signedInput.hash).toString('hex') !== Buffer.from(unsignedInput.hash).toString('hex') ||
        signedInput.index !== unsignedInput.index) {
      return false
    }
  }

  for (let i = 0; i < signed.txOutputs.length; i++) {
    const signedOutput = signed.txOutputs[i];
    const unsignedOutput = unsigned.txOutputs[i];

    if (signedOutput == null || unsignedOutput == null) return false
    if (signedOutput.script == null || unsignedOutput.script == null) return false
    
    if (signedOutput.value !== unsignedOutput.value ||
        Buffer.from(signedOutput.script).toString('hex') !== Buffer.from(unsignedOutput.script).toString('hex')) {
      return false
    }
  }

  return true
}
