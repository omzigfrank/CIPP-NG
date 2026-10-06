#Requires -Version 7.0
<#
.SYNOPSIS
    Cut management.omzig.it over from Flex + Static Web App to the CIPP NG Web App, or back.

.DESCRIPTION
    Run only after the Cloudflare records exist:
      TXT   asuid.management.omzig.it  = <customDomainVerificationId of the subscription>
      CNAME management.omzig.it        -> cippwemix.azurewebsites.net

    Cutover (default):
      1. Preflight: the new app is healthy, the CNAME and TXT records resolve as expected.
      2. Stop cippwemix-flex, so no background work runs twice.
      3. Delete App__Scheduler__ConfigFile (the paused, empty timer file); the app restarts with
         Craft's full schedule, including the two omzig.ai sentinels.
      4. Wait for /api/setup/health.
      5. Remove the hostname from the Static Web App, add it to the Web App, create an App
         Service Managed Certificate and bind it (SNI).
      6. Verify PublicPing and version.json on https://management.omzig.it.
    Afterwards, in CIPP: Advanced > Authentication > SSO > Refresh Sign-in URLs.

    -Rollback reverses it: hostname off the Web App, schedule paused again, Flex started.
    Point the CNAME back to the Static Web App and re-add the hostname there
    (az staticwebapp hostname set).

    Uses the az CLI as the signed-in operator (Owner or Contributor on resource group CIPP).
.EXAMPLE
    ./Invoke-OmzigNgCutover.ps1 -WhatIf
.EXAMPLE
    ./Invoke-OmzigNgCutover.ps1 -Confirm:$false
#>
[CmdletBinding(SupportsShouldProcess, ConfirmImpact = 'High')]
param(
    [string]$ResourceGroup = 'CIPP',
    [string]$WebApp = 'cippwemix',
    [string]$FlexApp = 'cippwemix-flex',
    [string]$StaticWebApp = 'cipp-swa-wemix',
    [string]$Hostname = 'management.omzig.it',
    [switch]$Rollback,
    [switch]$SkipDnsCheck
)
$ErrorActionPreference = 'Stop'

function Wait-Healthy([string]$Url, [int]$Minutes = 10) {
    $Deadline = (Get-Date).AddMinutes($Minutes)
    while ((Get-Date) -lt $Deadline) {
        try {
            $R = Invoke-WebRequest $Url -TimeoutSec 30 -SkipHttpErrorCheck
            if ($R.StatusCode -eq 200) { return $true }
        } catch { Write-Verbose $_.Exception.Message }
        Start-Sleep -Seconds 15
    }
    return $false
}

function Invoke-Az([string[]]$Arguments) {
    $Out = & az @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw "az $($Arguments -join ' ') failed: $Out" }
    $Out
}

$AppHost = "$WebApp.azurewebsites.net"

if ($Rollback) {
    if ($PSCmdlet.ShouldProcess($Hostname, 'Roll back to Flex + Static Web App')) {
        $Bound = Invoke-Az @('webapp', 'config', 'hostname', 'list', '-g', $ResourceGroup, '--webapp-name', $WebApp, '--query', '[].name', '-o', 'tsv')
        if ($Bound -contains $Hostname) { Invoke-Az @('webapp', 'config', 'hostname', 'delete', '-g', $ResourceGroup, '--webapp-name', $WebApp, '--hostname', $Hostname) | Out-Null }
        Invoke-Az @('webapp', 'config', 'appsettings', 'set', '-g', $ResourceGroup, '-n', $WebApp, '--settings', 'App__Scheduler__ConfigFile=Config/OmzigTimersPaused.json', '-o', 'none') | Out-Null
        Invoke-Az @('webapp', 'start', '-g', $ResourceGroup, '-n', $FlexApp) | Out-Null
        Write-Host "Rolled back: $WebApp paused, $FlexApp started. Now point the CNAME at the Static Web App and run:"
        Write-Host "  az staticwebapp hostname set -n $StaticWebApp -g $ResourceGroup --hostname $Hostname"
    }
    return
}

# 1. Preflight
if (-not (Wait-Healthy "https://$AppHost/api/setup/health" -Minutes 1)) { throw "$AppHost is not healthy; not cutting over." }
if (-not $SkipDnsCheck) {
    $Cname = (Resolve-DnsName $Hostname -Type CNAME -DnsOnly -ErrorAction Stop | Where-Object Type -EQ 'CNAME').NameHost
    if ($Cname -ne $AppHost) { throw "$Hostname CNAME is '$Cname', not $AppHost. Change it in Cloudflare first." }
    $VerificationId = Invoke-Az @('webapp', 'show', '-g', $ResourceGroup, '-n', $WebApp, '--query', 'customDomainVerificationId', '-o', 'tsv')
    $Txt = (Resolve-DnsName "asuid.$Hostname" -Type TXT -DnsOnly -ErrorAction SilentlyContinue).Strings
    if ($Txt -notcontains $VerificationId) { throw "TXT asuid.$Hostname does not contain the verification id $VerificationId." }
}

if (-not $PSCmdlet.ShouldProcess($Hostname, "Cut over from $FlexApp + $StaticWebApp to $WebApp")) { return }

# 2. Stop Flex first, so the schedule never runs in two places.
Invoke-Az @('webapp', 'stop', '-g', $ResourceGroup, '-n', $FlexApp) | Out-Null
Write-Host "Stopped $FlexApp $(Get-Date -AsUTC -Format 'HH:mm:ss')Z"

# 3-4. Un-pause the schedule (restarts the app) and wait for it.
Invoke-Az @('webapp', 'config', 'appsettings', 'delete', '-g', $ResourceGroup, '-n', $WebApp, '--setting-names', 'App__Scheduler__ConfigFile') | Out-Null
Start-Sleep -Seconds 20
if (-not (Wait-Healthy "https://$AppHost/api/setup/health")) {
    Write-Warning "$WebApp did not become healthy after un-pausing. Roll back with -Rollback."
    throw 'Cutover stopped after step 3.'
}
Write-Host "Schedule running on $WebApp $(Get-Date -AsUTC -Format 'HH:mm:ss')Z"

# 5. Move the hostname and certificate.
$SwaHosts = Invoke-Az @('staticwebapp', 'hostname', 'list', '-n', $StaticWebApp, '-g', $ResourceGroup, '--query', '[].domainName', '-o', 'tsv')
if ($SwaHosts -contains $Hostname) { Invoke-Az @('staticwebapp', 'hostname', 'delete', '-n', $StaticWebApp, '-g', $ResourceGroup, '--hostname', $Hostname, '--yes') | Out-Null }
Invoke-Az @('webapp', 'config', 'hostname', 'add', '-g', $ResourceGroup, '--webapp-name', $WebApp, '--hostname', $Hostname) | Out-Null
$Thumb = Invoke-Az @('webapp', 'config', 'ssl', 'create', '-g', $ResourceGroup, '-n', $WebApp, '--hostname', $Hostname, '--query', 'thumbprint', '-o', 'tsv')
Invoke-Az @('webapp', 'config', 'ssl', 'bind', '-g', $ResourceGroup, '-n', $WebApp, '--certificate-thumbprint', $Thumb, '--ssl-type', 'SNI') | Out-Null
Write-Host "$Hostname bound to $WebApp with certificate $Thumb"

# 6. Verify.
if (-not (Wait-Healthy "https://$Hostname/api/PublicPing" -Minutes 5)) { Write-Warning "https://$Hostname/api/PublicPing is not answering yet (certificate or DNS may still be propagating)." }
$Version = (Invoke-RestMethod "https://$Hostname/version.json" -TimeoutSec 30).tag
Write-Host "Cutover complete: https://$Hostname serves $Version. Next: CIPP > Advanced > Authentication > SSO > Refresh Sign-in URLs."
