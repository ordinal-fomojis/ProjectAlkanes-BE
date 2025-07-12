import { Network, networks } from "bitcoinjs-lib"
import { BITCOIN_NETWORK, BitcoinNetwork } from "../../../config/constants.js"

export const Networks: Record<BitcoinNetwork, Network> = {
  mainnet: networks.bitcoin,
  testnet: networks.testnet,
  signet: networks.testnet,
}

export const BTC_JS_NETWORK = Networks[BITCOIN_NETWORK]
