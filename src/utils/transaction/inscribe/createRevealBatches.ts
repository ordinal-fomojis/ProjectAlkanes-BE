import { Payment, Signer } from "bitcoinjs-lib"
import { ServerError } from "../../errors.js"
import { randomTransactionId } from "../utils/randomTransactionId.js"
import { createRevealPayment } from "./createRevealPayment.js"
import { createRevealTransaction, InscriptionOutput } from "./createRevealTransaction.js"

const MAX_TX_SIZE = 99_000

interface RevealDetails {
  virtualSize: number
  outputValue: number
  payment: Payment
  files: InscriptionOutput[]
}

export function createRevealBatches(files: InscriptionOutput[], key: Signer) {
  const batches: RevealDetails[] = []
  const totalSize = files.reduce((acc, file) => acc + (file.content?.data.length ?? 0), 0) / 4
  const averageSize = Math.ceil(totalSize / (4 * files.length))
  const initialGuess = Math.floor(MAX_TX_SIZE / averageSize)
  
  let index = 0
  while (index < files.length) {
    const batch = generateBatch(index, initialGuess, files, key)
    index += batch.files.length
    batches.push(batch)
  }
  return batches
}

function generateBatch(startIndex: number, initialGuess: number, files: InscriptionOutput[], key: Signer) {
  // hi is always larger than the max tx size, while lo is always lower (unless there are not enough files to exceed the max)
  // Once lo and hi differ by one, then lo must be the max number of files that can fit in a single tx (or lo equals the number of files)
  let hi: RevealDetails | null = null
  let lo: RevealDetails | null = null
  for (let attempts = 0; attempts < 10; attempts++) {
    const sizeEstimate = calculateBatchSizeEstimate(hi, lo, initialGuess)
    const batchFiles = files.slice(startIndex, startIndex + Math.max(1, sizeEstimate))
    const dummyInput = {
      hash: randomTransactionId(),
      index: 0,
      value: batchFiles.reduce((sum, file) => sum + file.padding, 0)
    }
    const payment = createRevealPayment(key, batchFiles)
    const reveal = createRevealTransaction(payment, batchFiles, key, dummyInput)
    const virtualSize = reveal.virtualSize()
    const outputValue = reveal.outs.reduce((sum, out) => sum + out.value, 0)
    if (virtualSize > MAX_TX_SIZE) {
      hi = { virtualSize, payment, files: batchFiles, outputValue }
    } else {
      lo = { virtualSize, payment, files: batchFiles, outputValue }
    }
    if (lo != null && hi != null && lo.files.length === hi.files.length - 1) {
      return lo
    }
    if (lo != null && lo.files.length === files.length - startIndex) {
      return lo
    }
  }

  // If failed to find a batch after several attempts, use lo (assuming it exists), because it must be under the allowed size
  if (lo != null) {
    return lo
  }
  throw new ServerError('Failed to generate a valid batch of transactions')
}

function calculateBatchSizeEstimate(hi: RevealDetails | null, lo: RevealDetails | null, defaultGuess: number) {
  if (hi != null && lo != null) {
    // If we have data points for hi and lo points, linearly interpolate between them and take the target tx size
    const m = (hi.files.length - lo.files.length) / (hi.virtualSize - lo.virtualSize)
    const c = hi.files.length - m * hi.virtualSize
    return Math.floor(m * MAX_TX_SIZE + c)
  }

  // If we only have one of hi or lo, linearly interpolate using the origin as the other point
  if (hi != null) return Math.floor(MAX_TX_SIZE / (hi.virtualSize / hi.files.length))
  if (lo != null) return Math.floor(MAX_TX_SIZE / (lo.virtualSize / lo.files.length))

  return defaultGuess
}
