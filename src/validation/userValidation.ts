import Joi from 'joi';

export const createUserSchema = Joi.object({
  walletAddress: Joi.string()
    .required()
    .min(26) // Minimum Bitcoin address length
    .max(90) // Maximum Bitcoin address length
    .pattern(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$|^bc1p[a-z0-9]{39,59}$|^[2-9A-HJ-NP-Za-km-z]{26,35}$/)
    .messages({
      'string.empty': 'Wallet address cannot be empty',
      'string.min': 'Wallet address must be at least 26 characters long',
      'string.max': 'Wallet address must be at most 90 characters long',
      'string.pattern.base': 'Invalid wallet address format',
      'any.required': 'Wallet address is required'
    })
});

export const walletAddressSchema = Joi.object({
  walletAddress: Joi.string()
    .required()
    .min(26)
    .max(90)
    .pattern(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$|^bc1p[a-z0-9]{39,59}$|^[2-9A-HJ-NP-Za-km-z]{26,35}$/)
    .messages({
      'string.empty': 'Wallet address cannot be empty',
      'string.min': 'Wallet address must be at least 26 characters long',
      'string.max': 'Wallet address must be at most 90 characters long',
      'string.pattern.base': 'Invalid wallet address format',
      'any.required': 'Wallet address is required'
    })
}); 