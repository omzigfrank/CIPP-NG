// omzig.ai CIPP NG Web App: a Linux container running our image (Craft + CIPP + the omzig.ai
// overlay), on the existing storage account and Key Vault.
//
// Based on upstream deployment/cipp-migration.bicep (CyberDrain/CIPP, 11.0.2). Differences:
//  - the image comes from our registry (cippwemixacr), pulled with the app's managed identity
//    (AcrPull), so no registry password is stored;
//  - B3 instead of B2 (one instance carries the portal and all background work);
//  - our settings: CIPP_KV_NAME, OMZIG_PORTAL_URL, WEBSITES_PORT, and optionally a paused
//    scheduler (App__Scheduler__ConfigFile -> an empty timer file) for verification next to
//    the live instance;
//  - logs to law-cipp-wemix; no resource-group tag resource (upstream's replaces all tags).
//
// WARNING: siteConfig.appSettings REPLACES every app setting. Craft writes its own sign-in
// settings at start-up, so never redeploy this over a running app. Change one setting with
// `az webapp config appsettings set|delete` instead.

@description('Web App name. Must equal the Key Vault name: Craft finds its vault from the site name.')
param webAppName string = 'cippwemix'

@description('Container image, e.g. cippwemixacr.azurecr.io/cipp:11.0.2-omzig.1')
param containerImage string

param location string = resourceGroup().location
param planSku string = 'B3'
param registryName string = 'cippwemixacr'
param storageAccountName string = 'cippstgwemix'
param keyVaultName string = webAppName
param logAnalyticsWorkspaceName string = 'law-cipp-wemix'
param portalUrl string = 'https://management.omzig.it'

@description('Start with no background schedule (empty timer file), for verification next to a live instance.')
param schedulerPaused bool = true

resource storageAccount 'Microsoft.Storage/storageAccounts@2024-01-01' existing = {
  name: storageAccountName
}

resource keyVault 'Microsoft.KeyVault/vaults@2022-07-01' existing = {
  name: keyVaultName
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: registryName
}

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: logAnalyticsWorkspaceName
}

var storageConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'

var baseSettings = [
  { name: 'AzureWebJobsStorage', value: storageConnectionString }
  { name: 'WEBSITE_RESOURCE_GROUP', value: resourceGroup().name }
  { name: 'CIPP_KV_NAME', value: keyVaultName }
  { name: 'OMZIG_PORTAL_URL', value: portalUrl }
  { name: 'WEBSITES_PORT', value: '8080' }
]
var pausedSettings = schedulerPaused ? [
  { name: 'App__Scheduler__ConfigFile', value: 'Config/OmzigTimersPaused.json' }
] : []

resource plan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: '${webAppName}-plan'
  location: location
  sku: {
    name: planSku
    capacity: 1
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

resource webApp 'Microsoft.Web/sites@2024-11-01' = {
  name: webAppName
  location: location
  kind: 'app,linux,container'
  identity: {
    type: 'SystemAssigned'
  }
  tags: {
    purpose: 'cipp-ng'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    reserved: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${containerImage}'
      acrUseManagedIdentityCreds: true
      alwaysOn: true
      http20Enabled: true
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      healthCheckPath: '/api/setup/health'
      // As upstream: recycle the container when the health endpoint keeps returning 500, never
      // one younger than 10 minutes.
      autoHealEnabled: true
      autoHealRules: {
        triggers: {
          statusCodes: [
            {
              status: 500
              subStatus: 0
              win32Status: 0
              count: 5
              timeInterval: '00:10:00'
              path: '/api/setup/health'
            }
          ]
        }
        actions: {
          actionType: 'Recycle'
          minProcessExecutionTime: '00:10:00'
        }
      }
      appSettings: concat(baseSettings, pausedSettings)
    }
  }
}

// Key Vault uses access policies (not RBAC). Craft reads and writes secrets.
resource kvAccessPolicy 'Microsoft.KeyVault/vaults/accessPolicies@2022-07-01' = {
  name: 'add'
  parent: keyVault
  properties: {
    accessPolicies: [
      {
        tenantId: subscription().tenantId
        objectId: webApp.identity.principalId
        permissions: {
          keys: []
          secrets: ['all']
          certificates: []
        }
      }
    ]
  }
}

// As upstream: Contributor on itself, so Craft can write its own sign-in configuration.
resource selfContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(webApp.id, 'Contributor', 'cipp')
  scope: webApp
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b24988ac-6180-42a0-ab88-20f7382dd24c')
    principalId: webApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Pull our image with the managed identity.
resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, webApp.id, 'AcrPull')
  scope: registry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: webApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'to-${logAnalyticsWorkspaceName}'
  scope: webApp
  properties: {
    workspaceId: logAnalytics.id
    logs: [
      {
        categoryGroup: 'allLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

output hostname string = webApp.properties.defaultHostName
output principalId string = webApp.identity.principalId
output customDomainVerificationId string = webApp.properties.customDomainVerificationId
