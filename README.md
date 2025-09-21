# Shovel Backend

A Node.js/Express.js backend API for shovel.space.

## Tech Stack

- **Runtime**: Node.js v22.x
- **Framework**: Express.js 5
- **Language**: TypeScript 5
- **Database**: MongoDB
- **Validation**: Zod
- **Security**: Helmet, CORS, Rate Limiting
- **Observability**: OpenTelemetry
- **Testing**: Vitest

## Quick Start

1. Install Dependencies and Initialise .env file

```bash
npm i
npm run init
```

If you get an authorization error, you likely don't have read access to the Azure Key Vault. Contact Vannix to get access.

2. Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:8080`

## Detailed Documentation
- [Environments](/docs/ENVIRONMENTS.md)

## Development

### Available Scripts

```bash
npm run dev             # Start development server with hot reload
npm run build           # Build TypeScript to JavaScript
npm run start           # Start production server
npm run clean           # Clean build directory
npm test                # Run tests with Vitest
npm run test:coverage   # Run tests with coverage report
npm run lint            # Lint code with ESLint
npm run init            # Create .env file from dev environment
npm run plop            # Run Plop.js for helpful utilities
```

### Project Structure

```
src/
├── config/                # Configuration (env vars, DB connection)
├── database/              # MongoDB connection and index setup
├── instrumentation/       # OpenTelemetry setup and helpers
├── middleware/            # Express middleware (security, validation, ...)
├── routes/                # Express route handlers, organized by feature
├── services/              # Database operations
├── utils/                 # Utility functions (errors, parsing, fetch with retry) and business logic
└── index.ts               # App entry point (Express app, route wiring, DB connect)
tests/
├── test-utils/            # Test utilities and mock data
└── ...                    # Vitest tests, mirroring `src/` structure
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

ISC 
