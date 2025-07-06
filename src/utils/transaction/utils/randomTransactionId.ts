export function randomTransactionId() {
  return randomHex(64)
}

function randomHex(length: number) {
  return [...Array(length)].map(() => randomIntLessThan(16).toString(16)).join('')
}

function randomIntLessThan(max: number) {
  return Math.floor(Math.random() * max)
}
