/**
 * Validation utilities for portfolio endpoints
 */

export interface ValidationResult {
  isValid: boolean
  error?: string
}

/**
 * Basic Bitcoin address validation
 * This covers all valid Bitcoin address formats:
 * - Legacy (P2PKH): 1xxx... (26-35 characters)
 * - P2SH: 3xxx... (26-35 characters) 
 * - Bech32 (P2WPKH/P2WSH): bc1xxx... (42-62 characters)
 * - Bech32m (P2TR): bc1p... (62 characters)
 * @param address - Bitcoin address to validate
 * @returns ValidationResult
 */
export function validateAddress(address: string): ValidationResult {
  if (!address || typeof address !== 'string') {
    return {
      isValid: false,
      error: 'Address is required and must be a string'
    }
  }

  const trimmedAddress = address.trim()
  
  if (trimmedAddress.length === 0) {
    return {
      isValid: false,
      error: 'Address cannot be empty'
    }
  }

  // Comprehensive Bitcoin address format validation
  // Supports all current Bitcoin address formats
  const bitcoinAddressRegex = /^(bc1[a-z0-9]{39,59}|bc1p[a-z0-9]{59}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/
  
  if (!bitcoinAddressRegex.test(trimmedAddress)) {
    return {
      isValid: false,
      error: 'Invalid Bitcoin address format. Supported formats: Legacy (1xxx...), P2SH (3xxx...), Bech32 (bc1xxx...), Bech32m (bc1p...)'
    }
  }

  return {
    isValid: true
  }
} 