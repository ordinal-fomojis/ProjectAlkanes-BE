# Security Documentation

## 🔒 Security Measures Implemented

### 1. Input Validation & Sanitization

#### Joi Schema Validation
- **Wallet Address Validation**: Strict regex patterns for Bitcoin addresses
- **Length Validation**: 26-90 character limits
- **Format Validation**: Supports Legacy, SegWit, and Native SegWit addresses
- **Required Field Validation**: Ensures all required fields are present

#### Input Sanitization
- **HTML Tag Removal**: Strips `<script>`, `<iframe>`, and other HTML tags
- **Character Filtering**: Only allows alphanumeric, hyphens, and dots
- **Case Normalization**: Converts to lowercase for consistency
- **Whitespace Trimming**: Removes leading/trailing spaces

### 2. Security Headers (Helmet + Custom)

#### Standard Helmet Headers
- `X-Content-Type-Options: nosniff` - Prevents MIME type sniffing
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-XSS-Protection: 1; mode=block` - XSS protection
- `Referrer-Policy: strict-origin-when-cross-origin` - Controls referrer information

#### Custom Security Headers
- Removes `X-Powered-By` header to hide server technology
- Additional content type validation for POST/PUT requests

### 3. Rate Limiting

- **Window**: 15 minutes (900,000ms)
- **Limit**: 100 requests per IP address
- **Scope**: Applied globally to all routes
- **Response**: JSON error message when limit exceeded

### 4. CORS Protection

- **Origin Restriction**: Configurable via `CORS_ORIGIN` environment variable
- **Credentials**: Enabled for authenticated requests
- **Methods**: Standard HTTP methods allowed
- **Headers**: Standard headers permitted

### 5. Request Size Limits

- **JSON Payload**: 10MB maximum
- **URL Encoded**: 10MB maximum
- **Prevents**: Large payload attacks and DoS attempts

### 6. Database Security

#### MongoDB Query Protection
- **Parameterized Queries**: Uses MongoDB driver's built-in protection
- **Input Sanitization**: All user inputs are sanitized before database operations
- **No Raw Queries**: No direct string concatenation in queries

#### Connection Security
- **Environment Variables**: Database credentials stored in `.env`
- **Connection Pooling**: Managed by MongoDB driver
- **Error Handling**: Graceful connection failure handling

### 7. Error Handling

#### Production vs Development
- **Development**: Full error messages and stack traces
- **Production**: Generic error messages only
- **No Information Leakage**: Sensitive data never exposed in errors

#### Global Error Handler
- Catches all unhandled errors
- Logs errors for debugging
- Returns consistent error format

### 8. Request Logging

- **Timestamp**: ISO format timestamps
- **Method & Path**: Logs all HTTP requests
- **No Sensitive Data**: Never logs passwords or tokens
- **Structured Format**: Easy to parse and analyze

## 🛡️ Security Best Practices

### 1. Principle of Least Privilege
- Only essential endpoints exposed
- No admin functions in public API
- Minimal user data stored

### 2. Defense in Depth
- Multiple layers of validation
- Input sanitization at multiple points
- Comprehensive error handling

### 3. Secure by Default
- All security measures enabled by default
- No insecure configurations
- Environment-specific settings

### 4. Regular Updates
- Dependencies regularly updated
- Security patches applied promptly
- Monitoring for vulnerabilities

## 🔍 Security Testing Recommendations

### 1. Input Validation Testing
```bash
# Test wallet address validation
curl -X POST http://localhost:8080/api/users \
  -H "Content-Type: application/json" \
  -d '{"walletAddress": "<script>alert(1)</script>"}'
```

### 2. Rate Limiting Testing
```bash
# Test rate limiting
for i in {1..110}; do
  curl -X GET http://localhost:8080/health
done
```

### 3. CORS Testing
```bash
# Test CORS from different origin
curl -X POST http://localhost:8080/api/users \
  -H "Origin: http://malicious-site.com" \
  -H "Content-Type: application/json" \
  -d '{"walletAddress": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"}'
```

## 🚨 Security Considerations

### 1. Environment Variables
- Never commit `.env` files to version control
- Use strong, unique passwords for database
- Rotate credentials regularly

### 2. Production Deployment
- Use HTTPS in production
- Configure proper firewall rules
- Monitor logs for suspicious activity
- Regular security audits

### 3. Database Security
- Enable MongoDB authentication
- Use network-level access controls
- Regular database backups
- Monitor database access logs

### 4. API Security
- Consider implementing JWT authentication for future features
- Add request signing for sensitive operations
- Implement API versioning
- Add request/response logging

## 📋 Security Checklist

- [x] Input validation with Joi
- [x] Input sanitization
- [x] Security headers (Helmet)
- [x] Rate limiting
- [x] CORS protection
- [x] Request size limits
- [x] Error handling
- [x] Request logging
- [x] Database query protection
- [x] Environment variable usage
- [ ] HTTPS enforcement (production)
- [ ] Authentication system (future)
- [ ] Request signing (future)
- [ ] API versioning (future)

## 🔗 Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practices-security.html)
- [MongoDB Security Checklist](https://docs.mongodb.com/manual/security/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/) 