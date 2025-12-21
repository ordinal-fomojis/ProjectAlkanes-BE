export const DatabaseCollection = {
  AlkaneTokensV2: 'alkane_tokens_v2',
  ArchivedTransactions: 'archived_transactions',
  AuthNonces: 'auth_nonces',
  BlockHeights: 'block_heights',
  ConfirmedTransactions: 'confirmed_transactions',
  MempoolTransactions: 'mempool_transactions',
  MintTransactions: 'mint_transactions',
  UnconfirmedTransactions: 'unconfirmed_transactions',
  UnsignedAlkaneMintTransactions: 'unsigned_alkane_mint_transactions',
  UnsignedBrcMintTransactions: 'unsigned_brc_mint_transactions',
  Users: 'users',
  BrcTokens: 'brc_tokens'
} as const

export type DatabaseCollection = typeof DatabaseCollection[keyof typeof DatabaseCollection]
