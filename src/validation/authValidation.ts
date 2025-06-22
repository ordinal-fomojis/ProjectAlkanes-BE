import Joi from 'joi';

export const nonceRequestSchema = Joi.object({
  walletAddress: Joi.string()
    .required()
    .min(26) // Minimum Bitcoin address length
    .max(90) // Maximum Bitcoin address length
    .pattern(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$|^[2-9A-HJ-NP-Za-km-z]{26,35}$/)
    .messages({
      'string.empty': 'Wallet address cannot be empty',
      'string.min': 'Wallet address must be at least 26 characters long',
      'string.max': 'Wallet address must be at most 90 characters long',
      'string.pattern.base': 'Invalid wallet address format',
      'any.required': 'Wallet address is required'
    })
});

export const verifySignatureSchema = Joi.object({
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
  signature: Joi.string()
    .required()
    .min(10)
    .max(1000)
    .messages({
      'string.empty': 'Signature cannot be empty',
      'string.min': 'Signature must be at least 10 characters long',
      'string.max': 'Signature must be at most 1000 characters long',
      'any.required': 'Signature is required'
    }),
  message: Joi.string()
    .required()
    .min(10)
    .max(2000)
    .messages({
      'string.empty': 'Message cannot be empty',
      'string.min': 'Message must be at least 10 characters long',
      'string.max': 'Message must be at most 2000 characters long',
      'any.required': 'Message is required'
    })
}); 