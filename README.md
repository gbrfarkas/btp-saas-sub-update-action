# SAP BTP SaaS subscription update action

This action can be used to perform a batch update of all subscriptions for a multi-tenant SaaS application on SAP BTP.

## Inputs

### `api-url`

**Required** The base URL of the SaaS Provisioning Service API. (This can be obtained from the instance of the Cloud Management Service with plan cis-local in the provider subaccount.)

### `token-url`

**Required** Full OAuth token request URL for the SaaS provider subaccount.

### `client-id`

**Required** Client ID for the OAuth token request. Required to contain scopes `$XSAPPNAME.subscription.write` and `$XSAPPNAME.job.read`. (This can be obtained from the credentials of the saas-registry service of your multi-tenant application.)

### `client-secret`

**Required** Client secret for the OAuth token request.

### `timeout`

Maximum time to wait for all tenant subscriptions to be updated, in seconds. Default value: 120.

### `interval`

Interval to check the status of the update, in seconds. Default value: 5.

## Example usage

```yaml
uses: gbrfarkas/btp-saas-update-action
with:
  api-url: 'https://saas-manager.cfapps.<region>.hana.ondemand.com'
  token-url: 'https://<...>.authentication.<region>.hana.ondemand.com/oauth/token'
  client-id: '...'
  client-secret: '...'
  timeout: 180
  interval: 10
```