import { Transaction } from "bitcoinjs-lib"
import { decodeAlkaneOpCallsInTransaction } from "./decoder"
import { getMempoolTransactionIds } from "./getMempoolTransactionIds"
import { getRawTransactions } from "./getRawTransactions"

export async function getMempoolMints() {
  const request = await getRawTransactions(await getMempoolTransactionIds())
  const transactions = request.filter(x => x.success).map(x => x.response).map(tx => Transaction.fromHex(tx))
  const mints = transactions.map(tx => decodeAlkaneOpCallsInTransaction(tx)).flat()
    .filter(x => x?.calls.some(x => x.opcode === 77))
  return mints
}
