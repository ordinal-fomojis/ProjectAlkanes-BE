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

// Schema for creating custom referral link
export const createCustomLinkSchema = Joi.object({
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
  customReferralId: Joi.string()
    .required()
    .min(3)
    .max(20)
    .pattern(/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/)
    .messages({
      'string.empty': 'Custom referral ID cannot be empty',
      'string.min': 'Custom referral ID must be at least 3 characters long',
      'string.max': 'Custom referral ID must be at most 20 characters long',
      'string.pattern.base': 'Custom referral ID can only contain letters, numbers, and hyphens. Cannot start or end with hyphen.',
      'any.required': 'Custom referral ID is required'
    })
});

// Schema for entering referral code (updated to accept either referral code or custom ID)
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
    .min(3)
    .max(20)
    .messages({
      'string.empty': 'Referral code cannot be empty',
      'string.min': 'Referral code must be at least 3 characters long',
      'string.max': 'Referral code must be at most 20 characters long',
      'any.required': 'Referral code is required'
    })
}); 