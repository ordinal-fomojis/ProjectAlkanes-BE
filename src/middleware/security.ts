import { NextFunction, Request, Response } from 'express'

// Additional security headers
export const securityHeaders = (_: Request, res: Response, next: NextFunction): void => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  next();
};

// Request sanitization middleware
export const sanitizeRequest = (req: Request, _: Response, next: NextFunction): void => {
  // Sanitize request body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        // Remove HTML tags and dangerous characters but preserve auth-related characters
        req.body[key] = req.body[key]
          .replace(/<[^>]*>/g, '')
          .replace(/[^\w\-.\s:/\n\r\t]/g, '')  // Allow colons, slashes, newlines for auth messages
          .trim();
      }
    });
  }
  
  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = req.query[key]
          .replace(/<[^>]*>/g, '')
          .replace(/[^\w\-.\s]/g, '')
          .trim();
      }
    });
  }

  // Special handling for ticker parameters - preserve trailing spaces for token lookup
  if (req.params && req.params.ticker) {
    // Don't trim ticker parameters as they may contain meaningful trailing spaces
    // Only remove HTML tags and dangerous characters
    req.params.ticker = req.params.ticker
      .replace(/<[^>]*>/g, '')
      .replace(/[^\w\-.\s]/g, ''); // Allow alphanumeric, hyphens, dots, and spaces (including trailing)
  }

  // Special handling for alkane ID parameters - preserve trailing spaces for token lookup
  if (req.params && req.params.id) {
    // Don't trim ID parameters as they may contain meaningful trailing spaces
    // Only remove HTML tags and dangerous characters
    req.params.id = req.params.id
      .replace(/<[^>]*>/g, '')
      .replace(/[^\w\-.\s]/g, ''); // Allow alphanumeric, hyphens, dots, and spaces (including trailing)
  }
  
  next();
};

// Content type validation
export const validateContentType = (req: Request, res: Response, next: NextFunction): void => {
  if (req.method === 'POST' || req.method === 'PUT') {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      res.status(400).json({
        success: false,
        message: 'Content-Type must be application/json'
      });
      return;
    }
  }
  next();
}; 
