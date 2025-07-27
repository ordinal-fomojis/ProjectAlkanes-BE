import { ClientSession } from "mongodb"
import { DatabaseCollection } from "../database/collections.js"
import { BaseService } from "./BaseService.js"

export interface MintTransaction {
  wif: string
  serviceFee: number
  networkFee: number
  paddingCost: number
  totalCost: number
  paymentTxid: string
  alkaneId: string
  mintCount: number
  paymentAddress: string
  receiveAddress: string
  authenticatedUserAddress?: string
  txids: string[]
  created: Date
}

export class MintTransactionService extends BaseService<MintTransaction> {
  collectionName = DatabaseCollection.MintTransactions

  async createMintTransaction(mintTx: Omit<MintTransaction, 'created'>, session?: ClientSession) {
    const { insertedId } = await this.collection.insertOne({
      ...mintTx,
      created: new Date(),
    }, { session })

    return insertedId
  }

  async getMintTransactionsByPaymentAddress(paymentAddress: string) {
    return await this.collection
      .find({ paymentAddress })
      .sort({ created: -1 })
      .toArray()
  }

  /**
   * Enhanced wallet address search that handles both new and legacy transactions
   * 
   * Search Strategy:
   * 1. NEW transactions: Find by authenticatedUserAddress (most reliable)
   * 2. LEGACY transactions: Find by receiveAddress (ordinal address)  
   * 3. SAME-ADDRESS transactions: Find by paymentAddress (Unisat-style)
   * 
   * This ensures users see ALL their transactions regardless of when they were created
   */
  async getMintTransactionsByWalletAddress(walletAddress: string) {
    const normalizedAddress = walletAddress.toLowerCase().trim()
    
    return await this.collection
      .find({
        $or: [
          // NEW: Transactions with authenticated user address (most reliable)
          { authenticatedUserAddress: normalizedAddress },
          
          // LEGACY: Transactions where user's ordinal address is the receive address
          // This catches old Xverse/Oyl transactions where receiveAddress = user's ordinal
          { receiveAddress: normalizedAddress },
          
          // SAME-ADDRESS: Transactions where payment address = user address (Unisat style)
          // This catches transactions where user paid from their main address
          { paymentAddress: normalizedAddress }
        ]
      })
      .sort({ created: -1 })
      .toArray()
  }

  /**
   * Get transactions by multiple criteria for comprehensive search
   * Used for debugging and administrative purposes
   */
  async getMintTransactionsByMultipleAddresses(addresses: string[]) {
    const normalizedAddresses = addresses.map(addr => addr.toLowerCase().trim())
    
    return await this.collection
      .find({
        $or: [
          { authenticatedUserAddress: { $in: normalizedAddresses } },
          { receiveAddress: { $in: normalizedAddresses } },
          { paymentAddress: { $in: normalizedAddresses } }
        ]
      })
      .sort({ created: -1 })
      .toArray()
  }
}
