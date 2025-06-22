import Joi from 'joi';

// Schema for wallet address parameter
export const walletAddressSchema = Joi.object({
  walletAddress: Joi.string()
    .required()
    .min(26)
    .max(90)
    .pattern(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$|^[2-9A-HJ-NP-Za-km-z]{26,35}$/)
    .messages({
      'string.empty': 'Wallet address cannot be empty',
      'string.min': 'Wallet address must be at least 26 characters long',
      'string.max': 'Wallet address must be at most 90 characters long',
      'string.pattern.base': 'Invalid wallet address format',
      'any.required': 'Wallet address is required'
    })
});

// Schema for entering referral code
export const enterReferralCodeSchema = Joi.object({
  walletAddress: Joi.string()
    .required()
    .min(26)
    .max(90)
    .pattern(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$|^[2-9A-HJ-NP-Za-km-z]{26,35}$/)
    .messages({
      'string.empty': 'Wallet address cannot be empty',
      'string.min': 'Wallet address must be at least 26 characters long',
      'string.max': 'Wallet address must be at most 90 characters long',
      'string.pattern.base': 'Invalid wallet address format',
      'any.required': 'Wallet address is required'
    }),
  referralCode: Joi.string()
    .required()
    .length(6)
    .pattern(/^[A-Z0-9]+$/)
    .messages({
      'string.empty': 'Referral code cannot be empty',
      'string.length': 'Referral code must be exactly 6 characters',
      'string.pattern.base': 'Referral code must contain only uppercase letters and numbers',
      'any.required': 'Referral code is required'
    })
}); 