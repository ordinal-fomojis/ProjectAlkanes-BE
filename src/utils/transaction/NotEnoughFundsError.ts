import { UserError } from "../errors.js"

export class NotEnoughFundsError extends UserError {
  constructor(public cost: number) {
    super(`Not enough funds to cover cost of ${cost} sats`)
    this.name = 'NotEnoughFundsError'
  }
}
