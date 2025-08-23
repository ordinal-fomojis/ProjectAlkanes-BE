import { z } from 'zod'
import { MEMPOOL_API_URL } from '../config/env.js'
import { retrySchemaFetch } from '../utils/retryFetch.js'

// Schema for the mempool transaction API response
const TransactionResponseSchema = z.object({
  txid: z.string(),
  version: z.number(),
  locktime: z.number(),
  vin: z.array(z.any()),
  vout: z.array(z.any()),
  size: z.number(),
  weight: z.number(),
  fee: z.number(),
  status: z.object({
    confirmed: z.boolean(),
    block_height: z.number().optional(),
    block_hash: z.string().optional(),
    block_time: z.number().optional()
  })
});

export interface TransactionConfirmationResponse {
  confirmed: boolean;
  txid: string;
}

export class TransactionConfirmationService {
  /**
   * Check if a transaction is confirmed on the blockchain
   * @param txid - The transaction ID to check
   * @returns Promise with confirmation status
   */
  async checkTransactionConfirmation(txid: string): Promise<TransactionConfirmationResponse> {
    try {
      const response = await retrySchemaFetch(
        TransactionResponseSchema,
        `${MEMPOOL_API_URL}/api/tx/${txid}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'AMP-Backend/1.0.0'
          }
        }
      );

      return {
        confirmed: response.status.confirmed,
        txid: response.txid
      };
    } catch (error) {
      // If the transaction is not found or there's an error, we consider it unconfirmed
      console.error(`Error checking transaction confirmation for ${txid}:`, error);
      throw new Error(`Failed to check transaction confirmation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 
