# Environments

## Non-production Environments

- **dev**: [shovel-webapp-dev.azurewebsites.net](https://shovel-webapp-dev.azurewebsites.net)
  - Standard development environment
- **mock**: [shovel-webapp-mock.azurewebsites.net](https://shovel-webapp-mock.azurewebsites.net)
  - Mocks Bitcoin interactions, allowing testing without spending any BTC
- **testnet**: [shovel-webapp-testnet.azurewebsites.net](https://shovel-webapp-testnet.azurewebsites.net) (Not implemented yet)
  - Connects to Bitcoin testnet, allowing testing with testnet BTC

All non-production environments use a shared non-production database. This is seperate from the production database, to allow for safe testing.

Non-production environments are automatically deployed when a pull request is merged into the `main` branch.

Non-production environments can be deployed to manually from feature branches by running the deploy workflow in GitHub Actions.

## Production Environments

- **staging**: [shovel-webapp-prod-stage.azurewebsites.net](https://shovel-webapp-prod-stage.azurewebsites.net)
  - Identical to production, but not exposed via the main domain. Used for final testing on production data before deploying to production.
- **prod**: [api.shovel.space](https://api.shovel.space)
  - The live production environment serving data to users.

The production environment uses a separate production database, which should never be used for testing.

Production environments can only be deployed to from the `main` branch and must be manually triggered in GitHub Actions.

Running the action will only deploy to stage, not prod. This is to allow for final testing on production data before deploying to prod. To deploy to prod, you must swap the staging and prod slots in Azure, which can be done [here](https://portal.azure.com/#@vannixfomojis.onmicrosoft.com/resource/subscriptions/cc174810-b2c5-4ca2-8397-0c701e8a2b96/resourceGroups/shovel/providers/Microsoft.Web/sites/shovel-webapp-prod/deploymentSlotsV2).

We never deploy directly to prod for three reasons:
1. To allow for final testing on production data before deploying to prod
2. To eliminate downtime during deployment
3. To allow for easy rollback in case of issues
