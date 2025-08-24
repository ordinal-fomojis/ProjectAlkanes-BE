# Project Alkanes Backend

A Node.js/Express.js backend API for managing wallet-connected users in the Project Alkanes ecosystem.

## Features

- 🔐 **Wallet-based User Management** - Users identified by their Bitcoin wallet addresses
- 🛡️ **Security First** - Rate limiting, CORS, helmet, and input validation
- 📊 **MongoDB Integration** - Scalable database with proper indexing
- 🔄 **Auto-connect Logic** - Existing users automatically reconnect and update last login
- ✅ **Input Validation** - Safe wallet address validation using Joi
- 📝 **Comprehensive Logging** - Request logging and error tracking
- 🏥 **Health Checks** - Database and server status monitoring

## Tech Stack

- **Runtime**: Node.js v20.18.0
- **Framework**: Express.js 5.1.0
- **Language**: TypeScript 5.8.3
- **Database**: MongoDB 6.3.0
- **Validation**: Joi 17.11.0
- **Security**: Helmet, CORS, Rate Limiting

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Copy the example environment file and configure your settings:

```bash
cp env.example .env
```

Edit `.env` with your MongoDB connection details:

```env
# MongoDB Configuration
MONGODB_URI=mongodb://username:password@host:port/database
MONGODB_DB_NAME=project-alkanes

# Server Configuration
PORT=8080
NODE_ENV=development

# Security Configuration
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3. Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:8080`

## API Endpoints

### User Management

#### Connect/Create User
```http
POST /api/users
Content-Type: application/json

{
  "walletAddress": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User connected successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "walletAddress": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "lastLoginAt": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Get User by Wallet Address
```http
GET /api/users/bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh
```

### System Endpoints

#### Health Check
```http
GET /health
```

#### API Info
```http
GET /
```

## Database Schema

### Users Collection

```typescript
interface IUser {
  _id?: ObjectId;
  walletAddress: string;    // Primary identifier (normalized to lowercase)
  createdAt: Date;          // User creation timestamp
  lastLoginAt?: Date;       // Last login timestamp
}
```

## Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS Protection**: Configurable origin restrictions
- **Input Validation**: Wallet address format validation
- **Helmet**: Security headers
- **Request Logging**: All requests logged with timestamps
- **Error Handling**: Comprehensive error responses

## Development

### Available Scripts

```bash
npm run dev      # Start development server with hot reload
npm run build    # Build TypeScript to JavaScript
npm run start    # Start production server
npm run clean    # Clean build directory
```

### Project Structure

```
src/
├── config/
│   └── database.ts          # MongoDB connection configuration
├── middleware/
│   └── validation.ts        # Joi validation middleware
├── models/
│   └── User.ts              # User model and interfaces
├── routes/
│   └── userRoutes.ts        # User API routes
├── services/
│   └── userService.ts       # Business logic layer
├── validation/
│   └── userValidation.ts    # Joi validation schemas
└── index.ts                 # Main server file
```

## Frontend Integration

This backend is designed to work seamlessly with the LaserEyes wallet library. When a user connects their wallet in the frontend:

1. Frontend gets wallet address from LaserEyes
2. Frontend calls `POST /api/users` with the wallet address
3. Backend creates/updates user and returns user data
4. Frontend can use the returned data for user-specific features

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "walletAddress",
      "message": "Invalid wallet address format"
    }
  ]
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

ISC 
