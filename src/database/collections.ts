export const DatabaseCollection = {
  AlkaneTokens: 'alkane_tokens',
  AuthNonces: 'auth_nonces',
  BlockHeights: 'block_heights',
  ConfirmedTransactions: 'confirmed_transactions',
  MempoolTransactions: 'mempool_transactions',
  MintTransactions: 'mint_transactions',
  UnconfirmedTransactions: 'unconfirmed_transactions',
  UnsignedMintTransactions: 'unsigned_mint_transactions',
  Users: 'users',
  BrcTokens: 'brc_tokens'
} as const

export type DatabaseCollection = typeof DatabaseCollection[keyof typeof DatabaseCollection]
