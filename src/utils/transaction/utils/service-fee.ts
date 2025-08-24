export function getAlkaneMintServiceFee(mintCount: number) {
  return Math.max(1000, 250 * mintCount)
}

export function getBrcMintServiceFee(mintCount: number) {
  return Math.max(1000, 250 * mintCount)
}
