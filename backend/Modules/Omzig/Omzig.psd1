@{
    RootModule        = '.\Omzig.psm1'
    ModuleVersion     = '0.1.0'
    GUID              = '8f2a4c1e-93d7-4b6a-b1f0-6a5c2e9d0741'
    Author            = 'Omzig, Inc.'
    CompanyName       = 'Omzig, Inc.'
    Copyright         = '(c) 2026 Omzig, Inc. All rights reserved.'
    Description       = 'omzig.ai overlay for CIPP: PSA abstraction (Autotask primary, HaloPSA stub), Datto RMM (Vidal), break-glass and GDAP sentinels, AI product pricing floors, Omzig tenant records and client health score.'
    PowerShellVersion = '7.4'
    FunctionsToExport = @(
        'Connect-OmzigDattoRmm'
        'Find-OmzigAutotaskIntegrationUser'
        'Get-OmzigAutotaskZoneUrl'
        'Get-OmzigClientHealthScore'
        'Get-OmzigConfig'
        'Get-OmzigDattoAlerts'
        'Get-OmzigDattoApiUrl'
        'Get-OmzigDattoDevices'
        'Get-OmzigDattoRateLimit'
        'Get-OmzigDattoSites'
        'Get-OmzigPricingFloors'
        'Get-OmzigPsaClient'
        'Get-OmzigPsaContract'
        'Get-OmzigTenantRecord'
        'Get-OmzigTenantView'
        'Invoke-OmzigAutotaskRequest'
        'Invoke-OmzigBreakGlassPoll'
        'Invoke-OmzigBreakGlassSentinel'
        'Invoke-OmzigDattoRmmRequest'
        'Invoke-OmzigGdapExpiryPoll'
        'Invoke-OmzigGdapExpirySentinel'
        'Invoke-OmzigGdapSentinelRun'
        'Invoke-OmzigPortalWarmup'
        'Invoke-OmzigSentinelTimerRun'
        'New-OmzigTeamsCard'
        'Send-OmzigAlert'
        'Set-OmzigTenantRecord'
        'Test-OmzigBreakGlassAccount'
        'Test-OmzigPreflight'
        'Test-OmzigQuoteFloor'
        'Test-OmzigQuoteRequest'
        'Test-OmzigTenantSettings'
        'Receive-OmzigSentinelTimer'
        'Receive-OmzigGdapSentinelTimer'
    )
    CmdletsToExport   = @()
    VariablesToExport = @()
    AliasesToExport   = @()
    PrivateData       = @{
        PSData = @{
            Tags       = @('Omzig', 'CIPP', 'Autotask', 'DattoRMM', 'GDAP')
            ProjectUri = 'https://github.com/omzigfrank/CIPP-NG'
        }
    }
}
