import { describe, expect, it } from "vitest"
import { createAlkaneMintTransactionChain } from "../../src/utils/transaction/createAlkaneMintTransactionChain.js"
import { createScriptForAlkaneMint } from "../../src/utils/transaction/protostone/createScriptForAlkaneMint.js"
import { randomKey } from "../../src/utils/transaction/utils/keys.js"
import { randomAddress } from "../test-utils/btc-random.js"
import { expectToBeDefined } from "../test-utils/expect.js"
import Random from "../test-utils/Random.js"

describe("createAlkaneMintTransactionChain", () => {
  it("should create a chain of mint transactions", async () => {
    const utxo = {
      txid: Random.randomTransactionId(),
      vout: 0,
      value: 1000000,
    }
    
    const address = randomAddress()
    const runescript = createScriptForAlkaneMint('2:0')
    const txns = await createAlkaneMintTransactionChain({
      utxo,
      feePerMint: 1000,
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
      expect(currentTxn.outs[0]?.value).toBe(utxo.value - (i + 1) * 1000)
      expect(currentTxn.outs[1]?.script.toString('hex')).toBe(runescript.output?.toString('hex'))
    }
  })
})
