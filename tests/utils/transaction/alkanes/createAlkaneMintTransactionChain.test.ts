import { describe, expect, it } from "vitest"
import { createAlkaneMintScript } from "../../../../src/utils/transaction/alkanes/createAlkaneMintScript.js"
import { createAlkaneMintTransactionChain } from "../../../../src/utils/transaction/alkanes/createAlkaneMintTransactionChain.js"
import { randomKey } from "../../../../src/utils/transaction/utils/keys.js"
import Random from "../../../test-utils/Random.js"
import { randomAddress } from "../../../test-utils/btc-random.js"
import { expectToBeDefined } from "../../../test-utils/expect.js"

describe("createAlkaneMintTransactionChain", () => {
  it("should create a chain of mint transactions", async () => {
    const utxo = {
      txid: Random.randomTransactionId(),
      vout: 0,
      value: 1000000n,
    }
    
    const address = randomAddress()
    const runescript = createAlkaneMintScript('2:0')
    const txns = await createAlkaneMintTransactionChain({
      utxo,
      feePerMint: 1000n,
      feeOfFinalMint: 2000n,
      runescript,
      mintCount: 5,
      key: randomKey(),
      outputAddress: address
    })
    expect(txns).toHaveLength(5)
    const first = txns[0]
    expectToBeDefined(first)
    expect(Buffer.from(first.ins[0]?.hash.toReversed() ?? []).toString('hex')).toBe(utxo.txid)
    
    for (let i = 1; i < txns.length; i++) {
      const prevTxn = txns[i - 1]
      const currentTxn = txns[i]
      expectToBeDefined(prevTxn)
      expectToBeDefined(currentTxn)
      expect(Buffer.from(currentTxn.ins[0]?.hash.toReversed() ?? []).toString('hex')).toBe(prevTxn.getId())
      expect(currentTxn.outs[0]?.value).toBe(utxo.value - BigInt((i + 1) * 1000 + (i === txns.length - 1 ? 1000 : 0)))
      expect(Buffer.from(currentTxn.outs[1]!.script).toString('hex')).toBe(Buffer.from(runescript.output!).toString('hex'))
    }
  })
})
