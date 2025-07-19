import Joi from 'joi';

export const transactionConfirmationSchema = Joi.object({
  txid: Joi.string()
    .required()
    .length(64)
    .pattern(/^[a-fA-F0-9]{64}$/)
    .messages({
      'string.empty': 'Transaction ID cannot be empty',
      'string.length': 'Transaction ID must be exactly 64 characters long',
      'string.pattern.base': 'Transaction ID must be a valid hexadecimal string',
      'any.required': 'Transaction ID is required'
    })
}); 
