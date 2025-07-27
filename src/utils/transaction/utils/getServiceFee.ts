export function getServiceFee(mintCount: number) {
  return Math.max(1000, 250 * mintCount)
}
