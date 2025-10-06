# Environment Variables

The variables for each environment are in the `env` directory with a separate `.env` file for each environment. These are checked into git, using `dotenvx` to encrypt sensitive values.

## Environment Setup

Run `npm run init` to pull the non-production private keys for `dotenvx`, and create a `.env` file based on the `dev` environment.

If you get an authorization error, you likely don't have read access to the Azure Key Vault. Contact Vannix to get access.

Note: This will not pull the production private key. The production private key should not be kept on local machines to minimise the risk of it leaking. This should not impact development, because environment variables can be set without the private key.

In rare cases, where you do need the production private key, it can be manually retrieved from the Azure Key Vault (shovel-kv), but should not be stored on your machine longer than necessary.

## Adding or updating environment variables

#### Non-sensitive variables

Non-sensitive variables should be added directly to the relevant `.env` file in plain text.

Do not encrypt these, as it is useful to be able to track the values in version control.

#### Sensitive variables

Run `npm run plop` and select the `set-env-variable` option. Enter the name of the variable and its value for each environment.

Secrets are encrypted using the public key, so you do not need to have the private key to set an environment variable.

## Decrypting environment variables

Run `npm run plop` and select the `decrypt-env` option. Enter the name of the environment to decrypt, and it will print out the decrypted `.env` file. This requires you to have the private key. For non-production environments, this can be setup when you run `npm run init`.

## Running a specific environment locally

The default start commands (`npm run dev` and `npm start`) will use the standard `.env`. This is the recommended way to run the development environment, as it allows the developer to customise their environment variables as needed without risking committing them to version control.

However, in some cases it is useful to be able to run a specific environment locally. The following commands can be used to do this
```bash
npm run dev:dev
npm run dev:mock
npm run dev:testnet
npm run dev:prod     # Not recommended. Requires the production private key

npm run start:dev
npm run start:mock
npm run start:testnet
npm run start:prod   # Not recommended. Requires the production private key
```
