<#
.SYNOPSIS
    Read-only health check for the Omzig self-hosted CIPP instance.

.DESCRIPTION
    Runs every check that has ever caught a real CIPP outage here, and prints one
    table plus a prioritised action list. Nothing is modified. Safe to run any time,
    by anyone with Reader on the CIPP resource group + Key Vault secret read.

    Checks performed:
      1  Azure context and access
      2  Web App run state, and the retired Function Apps still stopped
      3  The credentials CIPP reads from the vault exist and are enabled
      4  LIVE token acquisition using the vault's current client secret   <-- catches AADSTS7000222
      5  CIPP-SAM app registration secret + certificate expiry runway
      6  Key Vault secret expiry metadata
      7  SAM refresh-token age (CIPP refresh tokens die at 90 days idle)
      8  Version drift: omzigfrank/CIPP-NG vs the CyberDrain/CIPP monorepo
      9  Upstream-sync PR status (the usual reason we fall behind)
      10 The newest image we built is the one running
      11 Stale / orphaned app-registration credentials
      12 Baseline hardening (HTTPS-only, min TLS)
      13 Auth error rate from Log Analytics
      14 DEPLOYED version: what the app itself serves (version.json), not what the repo says
      15 Background work is actually executing (Craft scheduler runs, started and completed)
      16 Container restarts (a crash loop or auto-heal recycling)
      17 Break-glass sentinel ran recently, and which tenants it cannot see
      18 GDAP expiry sentinel ran in the last day, and what is about to lapse
      19 The background schedule is not paused (the pre-cutover empty timer file)
      20 Memory headroom on the App Service plan

    Since 2026-10-06 CIPP runs as CIPP NG: one Linux container Web App (cippwemix, image
    from omzigfrank/CIPP-NG via cippwemixacr) that serves the portal and runs all background
    work on Craft. Logs are in law-cipp-wemix (AppServiceConsoleLogs). The Flex Function App
    and the older Consumption apps are retired rollback targets and must stay Stopped.

.PARAMETER SkipTokenTest
    Skip check 4. Use when the operator lacks Key Vault secret-read permission.

.PARAMETER SkipGitHub
    Skip checks 8, 9 and 10 (no outbound GitHub access).

.PARAMETER Json
    Emit the findings as JSON instead of a table (for scheduled runs / ticket automation).

.EXAMPLE
    .\Invoke-CippHealthCheck.ps1

.EXAMPLE
    .\Invoke-CippHealthCheck.ps1 -Json | Out-File cipp-health-2026-08.json

.NOTES
    Exit codes:  0 = all green   1 = warnings only   2 = at least one critical finding
    Requires: Azure CLI, logged in (az login) to the MCPP subscription.
#>
[CmdletBinding()]
param(
    [string]$Subscription     = '48019666-dd78-439e-9890-030ab5156f23',
    [string]$ResourceGroup    = 'CIPP',
    # The CIPP NG Web App: portal, API and all background work.
    [string]$ApiApp           = 'cippwemix',
    # Retired apps must stay Stopped. A running retired app runs every timer a second
    # time, so standards and alerts would hit client tenants twice.
    [string[]]$RetiredApps    = @('cippwemix-flex', 'cippwemix-proc'),
    [string]$VaultName        = 'cippwemix',
    [string]$SecretName       = 'applicationsecret',
    [string]$Workspace        = 'law-cipp-wemix',
    [string]$Fork             = 'omzigfrank/CIPP-NG',
    [string]$Branch           = 'main',
    [string]$Upstream         = 'CyberDrain/CIPP',
    [string]$UpstreamBranch   = 'main',
    [int]$SecretWarnDays      = 45,
    [switch]$SkipTokenTest,
    [switch]$SkipGitHub,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$script:Findings = [System.Collections.Generic.List[object]]::new()

function Add-Finding {
    param(
        [Parameter(Mandatory)][ValidateSet('OK', 'WARN', 'CRITICAL', 'INFO')][string]$Severity,
        [Parameter(Mandatory)][string]$Check,
        [Parameter(Mandatory)][string]$Detail,
        [string]$Action = ''
    )
    $script:Findings.Add([pscustomobject]@{
        Severity = $Severity
        Check    = $Check
        Detail   = $Detail
        Action   = $Action
    })
}

$script:LastAzError = ''

function Invoke-Az {
    <# az CLI wrapper: returns parsed JSON, or $null on failure instead of throwing.
       Keeps stderr in $script:LastAzError so callers can tell a permission problem
       apart from a genuinely missing resource. #>
    param([Parameter(Mandatory)][string[]]$Arguments)
    $script:LastAzError = ''
    $errFile = [System.IO.Path]::GetTempFileName()
    try {
        $raw = & az @Arguments -o json 2>$errFile
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($raw)) {
            $script:LastAzError = (Get-Content $errFile -Raw -ErrorAction SilentlyContinue)
            return $null
        }
        try { return $raw | ConvertFrom-Json } catch { return $null }
    } finally {
        Remove-Item $errFile -ErrorAction SilentlyContinue
    }
}

function Get-AzErrorSummary {
    <# One-line, truncated form of the last az error, so a finding names the actual
       problem instead of just asserting one. #>
    [OutputType([string])]
    param([int]$MaxLength = 200)
    $t = ($script:LastAzError -replace '\s+', ' ').Trim()
    if ($t.Length -gt $MaxLength) { $t = $t.Substring(0, $MaxLength) + '...' }
    return $t
}

function Test-AzAuthError {
    <# True when the last az call failed for lack of permission rather than absence.
       Reporting "cippwemix not found" at CRITICAL when the caller simply lacks a
       role sends people hunting a deleted resource that is sitting right there. #>
    [OutputType([bool])]
    param()
    return [bool]($script:LastAzError -match 'AuthorizationFailed|does not have authorization|Forbidden|\(403\)')
}

function Get-DaysUntil {
    param([Parameter(Mandatory)][datetime]$When)
    [int][math]::Floor(($When.ToUniversalTime() - [datetime]::UtcNow).TotalDays)
}

Write-Host "`nCIPP health check - $([datetime]::UtcNow.ToString('yyyy-MM-dd HH:mm')) UTC" -ForegroundColor Cyan
Write-Host ("=" * 72)

# ---------------------------------------------------------------- 1. Azure context
$account = Invoke-Az @('account', 'show')
if (-not $account) {
    Add-Finding CRITICAL 'Azure context' 'Not logged in to Azure CLI.' 'Run: az login'
    $script:Findings | Format-Table -AutoSize
    exit 2
}
if ($account.id -ne $Subscription) {
    & az account set --subscription $Subscription 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Add-Finding CRITICAL 'Azure context' "Cannot select subscription $Subscription." 'Check your access.'
        $script:Findings | Format-Table -AutoSize
        exit 2
    }
}
Add-Finding INFO 'Azure context' "Signed in as $($account.user.name) on '$($account.name)'."

# ------------------------------------------------------- 2. Web App run state
# NB: read the site through ARM rather than `az webapp show`. The CLI wrapper makes extra
# calls beyond reading the resource (publishing credentials among them), so it fails for a
# principal holding only Reader, which is exactly what the operators group and the scheduled
# service principal hold. A plain GET needs only Microsoft.Web/sites/read.
function Get-CippSite {
    param([Parameter(Mandatory)][string]$Name)
    $base = "https://management.azure.com/subscriptions/$Subscription/resourceGroups/$ResourceGroup/providers/Microsoft.Web/sites/$Name"
    $site = Invoke-Az @('rest', '--method', 'GET', '--url', "$base`?api-version=2023-12-01")
    if (-not $site) { return $null }
    # minTlsVersion and linuxFxVersion live on /config/web, not the site object. Also a plain read.
    $web = Invoke-Az @('rest', '--method', 'GET', '--url', "$base/config/web?api-version=2023-12-01")
    return [pscustomobject]@{
        state          = $site.properties.state
        kind           = $site.kind
        httpsOnly      = $site.properties.httpsOnly
        serverFarmId   = $site.properties.serverFarmId
        linuxFxVersion = $web.properties.linuxFxVersion
        siteConfig     = [pscustomobject]@{ minTlsVersion = $web.properties.minTlsVersion }
    }
}

$ApiSite = Get-CippSite -Name $ApiApp
if (-not $ApiSite) {
    if (Test-AzAuthError) {
        Add-Finding WARN 'Web app' "$ApiApp not readable: $(Get-AzErrorSummary)" `
            'Ask an admin to add you to CIPP-Azure-Operators.'
    } else {
        Add-Finding CRITICAL 'Web app' "$ApiApp not found. $(Get-AzErrorSummary)" `
            'Verify the app still exists.'
    }
} else {
    $image = ($ApiSite.linuxFxVersion -replace '^DOCKER\|', '')
    if ($ApiSite.state -eq 'Running') {
        Add-Finding OK 'Web app' "$ApiApp is Running ($image)."
    } else {
        Add-Finding CRITICAL 'Web app' "$ApiApp is '$($ApiSite.state)'. The portal and all background work are down." `
            "Run: az webapp start -g $ResourceGroup -n $ApiApp"
    }

    # ------------------------------------------------ 12. Baseline hardening
    if ($ApiSite.httpsOnly -ne $true) {
        Add-Finding WARN 'Hardening' "$ApiApp does not enforce HTTPS-only." `
            "Run: az webapp update -g $ResourceGroup -n $ApiApp --https-only true"
    }
    if ($ApiSite.siteConfig.minTlsVersion -and [double]$ApiSite.siteConfig.minTlsVersion -lt 1.2) {
        Add-Finding WARN 'Hardening' "$ApiApp min TLS is $($ApiSite.siteConfig.minTlsVersion)." 'Raise to 1.2 or higher.'
    }
}

foreach ($app in $RetiredApps | Where-Object { $_ }) {
    $site = Get-CippSite -Name $app
    if (-not $site) {
        if (Test-AzAuthError) {
            Add-Finding WARN 'Retired app' "$app not readable: $(Get-AzErrorSummary)" ''
        } else {
            Add-Finding INFO 'Retired app' "$app no longer exists."
        }
    } elseif ($site.state -eq 'Running') {
        Add-Finding CRITICAL 'Retired app' ("$app is Running. It was retired when CIPP moved to $ApiApp; " +
            'its timers run every job a second time against client tenants.') `
            "Run: az functionapp stop -g $ResourceGroup -n $app   (only restart it as part of a rollback: omzig-ops/deploy/Invoke-OmzigNgCutover.ps1 -Rollback)"
    } else {
        Add-Finding OK 'Retired app' "$app is $($site.state) (kept as a rollback target until it is decommissioned)."
    }
}

# ------------------------------------- 3. Key Vault references resolve to real secrets
$settings = Invoke-Az @('webapp', 'config', 'appsettings', 'list', '-g', $ResourceGroup, '-n', $ApiApp)
$vaultSecrets = Invoke-Az @('keyvault', 'secret', 'list', '--vault-name', $VaultName)

if (-not $settings) {
    if (Test-AzAuthError) {
        # Listing app settings is Microsoft.Web/sites/config/list/action — an ACTION,
        # which the built-in Reader role (*/read) does not grant. That is why
        # CIPP-Azure-Operators also carries the CIPP App Settings Reader custom role.
        Add-Finding WARN 'App settings' `
            "Cannot list app settings on $ApiApp (needs Microsoft.Web/sites/config/list/action): $(Get-AzErrorSummary)" `
            'Confirm you are in CIPP-Azure-Operators, which carries the CIPP App Settings Reader role.'
    } else {
        Add-Finding CRITICAL 'App settings' "Cannot read app settings on $ApiApp." 'Check RBAC.'
    }
} elseif (-not $vaultSecrets) {
    Add-Finding CRITICAL 'Key Vault' "Cannot list secrets in vault '$VaultName'." 'Check your Key Vault access.'
} else {
    $enabledNames = $vaultSecrets |
        Where-Object { $_.attributes.enabled } |
        ForEach-Object { ($_.id -split '/')[-1] }

    # CIPP NG reads its credentials from the vault directly (Get-CippKeyVaultName, by site name
    # or CIPP_KV_NAME), not through app-setting references, so the secrets themselves must exist.
    foreach ($required in 'applicationid', 'applicationsecret', 'RefreshToken', 'tenantid') {
        if (-not ($enabledNames | Where-Object { $_ -eq $required })) {
            Add-Finding CRITICAL 'Key Vault' "Secret '$required' is missing or disabled in vault $VaultName; CIPP cannot authenticate without it." `
                "Restore or re-create '$required' in vault $VaultName (Invoke-CippSecretRotation.ps1 for the client secret)."
        }
    }
    $refs = @($settings | Where-Object { $_.value -like '@Microsoft.KeyVault(*' })
    if ($refs.Count) { Add-Finding INFO 'Key Vault refs' "$($refs.Count) app settings resolve via Key Vault." }

    foreach ($ref in $refs) {
        # NB: not $secretName - PowerShell variable names are case-insensitive, so that
        # would silently overwrite the $SecretName parameter used later on.
        if ($ref.value -match 'SecretName=([^;)]+)') {
            $refSecret = $Matches[1]
            # Vault secret names are case-insensitive, so compare that way.
            if (-not ($enabledNames | Where-Object { $_ -eq $refSecret })) {
                Add-Finding CRITICAL 'Key Vault refs' `
                    "$($ref.name) points at secret '$refSecret' which is missing or disabled." `
                    "Restore or re-create '$refSecret' in vault $VaultName."
            }
        }
    }

    # Anything holding a literal credential instead of a reference is drift waiting to happen.
    foreach ($n in @('ApplicationSecret', 'RefreshToken')) {
        $s = $settings | Where-Object { $_.name -eq $n }
        if ($s -and $s.value -notlike '@Microsoft.KeyVault(*') {
            Add-Finding WARN 'App settings' "$n is a literal value, not a Key Vault reference." `
                "Repoint it at the vault so rotation only has to happen in one place."
        }
    }
}

# ---------------------------- 4. LIVE token test (the check that catches AADSTS7000222)
$appId = $null
if ($vaultSecrets) {
    $appId = (Invoke-Az @('keyvault', 'secret', 'show', '--vault-name', $VaultName, '--name', 'applicationid')).value
    $tenantId = (Invoke-Az @('keyvault', 'secret', 'show', '--vault-name', $VaultName, '--name', 'tenantid')).value
}

if ($SkipTokenTest) {
    Add-Finding INFO 'SAM auth' 'Live token test skipped (-SkipTokenTest).'
} elseif (-not $appId -or -not $tenantId) {
    Add-Finding WARN 'SAM auth' 'Could not read applicationid/tenantid from the vault; token test skipped.' `
        'Grant yourself Key Vault secret-read, or re-run with -SkipTokenTest.'
} else {
    $secret = (Invoke-Az @('keyvault', 'secret', 'show', '--vault-name', $VaultName, '--name', 'applicationsecret')).value
    if (-not $secret) {
        Add-Finding CRITICAL 'SAM auth' 'applicationsecret is unreadable or empty in the vault.' `
            'Run Invoke-CippSecretRotation.ps1.'
    } else {
        try {
            $body = @{
                client_id     = $appId
                client_secret = $secret
                scope         = 'https://graph.microsoft.com/.default'
                grant_type    = 'client_credentials'
            }
            $resp = Invoke-RestMethod -Method Post -TimeoutSec 30 `
                -Uri "https://login.microsoftonline.com/$tenantId/oauth2/v2.0/token" -Body $body
            if ($resp.access_token) {
                Add-Finding OK 'SAM auth' 'Vault secret successfully acquired a Graph token.'
            } else {
                Add-Finding CRITICAL 'SAM auth' 'Token endpoint returned no access_token.' 'Investigate immediately.'
            }
        } catch {
            $msg = $_.ErrorDetails.Message
            if (-not $msg) { $msg = $_.Exception.Message }
            $short = ($msg -replace '\s+', ' ')
            if ($short.Length -gt 220) { $short = $short.Substring(0, 220) }
            $action = if ($msg -match '7000222|invalid_client') {
                'Client secret is expired or wrong. Run Invoke-CippSecretRotation.ps1.'
            } else {
                'Investigate the Entra error below before touching anything else.'
            }
            Add-Finding CRITICAL 'SAM auth' "Token acquisition FAILED: $short" $action
        } finally {
            $secret = $null; $body = $null
            [System.GC]::Collect()
        }
    }
}

# ------------------------- 5 & 11. App registration credential runway + stale creds
if ($appId) {
    $pwCreds   = Invoke-Az @('ad', 'app', 'credential', 'list', '--id', $appId)
    $certCreds = Invoke-Az @('ad', 'app', 'credential', 'list', '--id', $appId, '--cert')

    # A clean report must mean "checked and fine", never "could not check". Reading
    # app credentials needs directory access (Graph Application.Read.All); the
    # scheduled service principal has none, so without this the single most
    # important check — is the SAM secret about to expire — would vanish silently
    # and the run would still say all green. That is the failure that took CIPP
    # down on 2026-07-22.
    if ($null -eq $pwCreds) {
        Add-Finding WARN 'SAM secret' `
            "Could not read CIPP-SAM credentials, so expiry runway was NOT checked. $(Get-AzErrorSummary 120)" `
            'Run as a user in CIPP-Azure-Admins, or grant the automation Graph Application.Read.All.'
    }

    if ($null -ne $pwCreds) {
        $live = @($pwCreds | Where-Object { [datetime]$_.endDateTime -gt [datetime]::UtcNow })
        $dead = @($pwCreds).Count - $live.Count

        if ($live.Count -eq 0) {
            Add-Finding CRITICAL 'SAM secret' 'CIPP-SAM has no unexpired client secret.' `
                'Run Invoke-CippSecretRotation.ps1 now.'
        } else {
            $furthest = ($live | Sort-Object { [datetime]$_.endDateTime } -Descending)[0]
            $days = Get-DaysUntil ([datetime]$furthest.endDateTime)
            if ($days -lt $SecretWarnDays) {
                Add-Finding WARN 'SAM secret' "Longest-lived client secret expires in $days days ($($furthest.displayName))." `
                    'Rotate this month: Invoke-CippSecretRotation.ps1'
            } else {
                Add-Finding OK 'SAM secret' "Client secret runway: $days days ($($furthest.displayName))."
            }
        }

        if ($dead -gt 0) {
            Add-Finding WARN 'Credential hygiene' "$dead expired client secret(s) still attached to CIPP-SAM." `
                'Remove them: az ad app credential delete --id <appId> --key-id <keyId>'
        }
        if ($live.Count -gt 2) {
            Add-Finding WARN 'Credential hygiene' "$($live.Count) live client secrets on CIPP-SAM (expected 1-2)." `
                'Each one is a full CSP-privileged credential. Delete every key-id CIPP is not using.'
        }
    }

    if ($null -eq $certCreds) {
        Add-Finding WARN 'SAM certificate' 'Could not read certificate credentials, so expiry was NOT checked.' `
            'Same cause as the SAM secret finding above.'
    }

    if ($null -ne $certCreds -and @($certCreds).Count -gt 0) {
        foreach ($c in $certCreds) {
            $days = Get-DaysUntil ([datetime]$c.endDateTime)
            $sev = if ($days -lt 0) { 'WARN' } elseif ($days -lt $SecretWarnDays) { 'WARN' } else { 'OK' }
            Add-Finding $sev 'SAM certificate' "'$($c.displayName)' runway: $days days."
        }
    }
}

# ----------------------------------------------- 6. Key Vault secret expiry metadata
if ($vaultSecrets) {
    foreach ($s in $vaultSecrets) {
        $name = ($s.id -split '/')[-1]
        if ($s.attributes.expires) {
            $days = Get-DaysUntil ([datetime]$s.attributes.expires)
            if ($days -lt 0) {
                Add-Finding CRITICAL 'Vault expiry' "Secret '$name' expiry date has passed ($days days)." `
                    'Rotate it and update the expiry metadata.'
            } elseif ($days -lt $SecretWarnDays) {
                Add-Finding WARN 'Vault expiry' "Secret '$name' expires in $days days." 'Schedule rotation.'
            }
        } elseif ($name -in @('applicationsecret', 'SSOAppSecret')) {
            Add-Finding WARN 'Vault expiry' "Secret '$name' has no expiry metadata." `
                "Set one so this check can warn you: az keyvault secret set-attributes --vault-name $VaultName --name $name --expires <ISO8601>"
        }
    }

    # ---------------------------------------------- 7. Refresh-token age (90-day idle limit)
    $rt = $vaultSecrets | Where-Object { ($_.id -split '/')[-1] -eq 'RefreshToken' }
    if ($rt) {
        $age = [int][math]::Floor(([datetime]::UtcNow - ([datetime]$rt.attributes.updated).ToUniversalTime()).TotalDays)
        if ($age -gt 80) {
            Add-Finding CRITICAL 'Refresh token' "SAM refresh token last updated $age days ago (90-day limit)." `
                'Re-run the CIPP SAM setup wizard to mint a new refresh token before it dies.'
        } elseif ($age -gt 60) {
            Add-Finding WARN 'Refresh token' "SAM refresh token is $age days old." 'Watch it; CIPP normally self-refreshes.'
        } else {
            Add-Finding OK 'Refresh token' "SAM refresh token is $age days old."
        }
    }
}

# ---------------------------------------------------------- 8 & 9. Version drift + sync PRs
function Get-GitHubJson {
    param([Parameter(Mandatory)][string]$Url)
    $headers = @{ 'User-Agent' = 'omzig-cipp-healthcheck' }
    if ($env:GH_TOKEN) { $headers['Authorization'] = "Bearer $env:GH_TOKEN" }
    try { return Invoke-RestMethod -Uri $Url -Headers $headers -TimeoutSec 30 } catch { return $null }
}
function Get-GitHubText {
    param([Parameter(Mandatory)][string]$Url)
    try { return (Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 30).Content.Trim() } catch { return $null }
}

$apiDeployed = $null
if ($SkipGitHub) {
    Add-Finding INFO 'Version' 'GitHub checks skipped (-SkipGitHub).'
} else {
    # Since CIPP NG one monorepo carries both halves; the version lives in backend/version_latest.txt.
    $apiDeployed = Get-GitHubText "https://raw.githubusercontent.com/$Fork/$Branch/backend/version_latest.txt"
    $apiLatest   = Get-GitHubText "https://raw.githubusercontent.com/$Upstream/$UpstreamBranch/backend/version_latest.txt"
    if (-not $apiDeployed -or -not $apiLatest) {
        Add-Finding WARN 'Version' "Could not read the version of $Fork or $Upstream." 'Check GitHub connectivity.'
    } elseif ($apiDeployed -eq $apiLatest) {
        Add-Finding OK 'Version' "$Fork is current with $Upstream at $apiDeployed."
    } else {
        Add-Finding WARN 'Version' "$Fork is on $apiDeployed; $Upstream is on $apiLatest." `
            'Merge the pull[bot] sync PR (next finding). A merge to main builds the new image (check 10).'
    }

    $prs = Get-GitHubJson "https://api.github.com/repos/$Fork/pulls?state=open&per_page=20"
    if ($null -eq $prs) {
        Add-Finding WARN 'Upstream sync' "Could not read open PRs on $Fork." 'Check GitHub connectivity or set GH_TOKEN.'
    } else {
        $sync = @($prs | Where-Object { $_.user.login -eq 'pull[bot]' })
        if ($sync.Count -eq 0) {
            Add-Finding OK 'Upstream sync' "$Fork has no pending upstream-sync PR."
        }
        foreach ($pr in $sync) {
            # mergeable_state is only present on the single-PR endpoint.
            $detail = Get-GitHubJson "https://api.github.com/repos/$Fork/pulls/$($pr.number)"
            $state = if ($detail) { $detail.mergeable_state } else { 'unknown' }
            $ageDays = [int][math]::Floor(([datetime]::UtcNow - ([datetime]$pr.created_at).ToUniversalTime()).TotalDays)
            if ($state -eq 'dirty') {
                Add-Finding CRITICAL 'Upstream sync' `
                    "$Fork PR #$($pr.number) has merge CONFLICTS and has been open $ageDays days. Updates are blocked." `
                    'Resolve conflicts (see runbook section "Unblocking a conflicted sync PR").'
            } elseif ($ageDays -gt 7) {
                Add-Finding WARN 'Upstream sync' "$Fork PR #$($pr.number) open $ageDays days, state '$state'." 'Merge it.'
            } else {
                Add-Finding INFO 'Upstream sync' "$Fork PR #$($pr.number) open $ageDays days, state '$state'."
            }
        }
    }
}

# ------------------------------------------------------- 10. The newest image is the one running
# omzig-image.yml builds <version>-omzig.<run number> on every merge to main. Deploying it is
# gated (OMZIG_AUTO_DEPLOY, or a manual run with deploy=true), so a built image can sit idle.
$runningTag = if ($ApiSite -and $ApiSite.linuxFxVersion -match ':(?<tag>[^:]+)$') { $Matches.tag } else { $null }
$runningNum = if ($runningTag -match 'omzig\.(?<n>\d+)$') { [int]$Matches.n } else { $null }
if ($SkipGitHub) {
    Add-Finding INFO 'Image' "GitHub checks skipped; $ApiApp runs '$runningTag'."
} elseif (-not $runningTag) {
    Add-Finding WARN 'Image' "Could not read the image tag $ApiApp runs." 'Check check 2 and your Reader access.'
} else {
    $builds = Get-GitHubJson "https://api.github.com/repos/$Fork/actions/workflows/omzig-image.yml/runs?branch=$Branch&status=success&per_page=1"
    $newest = @($builds.workflow_runs) | Select-Object -First 1
    if (-not $newest) {
        Add-Finding INFO 'Image' "$ApiApp runs $runningTag; could not read the image builds."
    } elseif ($runningNum -and [int]$newest.run_number -gt $runningNum) {
        $ageDays = [int][math]::Floor(([datetime]::UtcNow - ([datetime]$newest.updated_at).ToUniversalTime()).TotalDays)
        $sev = if ($ageDays -gt 7) { 'WARN' } else { 'INFO' }
        Add-Finding $sev 'Image' "Image omzig.$($newest.run_number) was built $ageDays day(s) ago, but $ApiApp still runs $runningTag." `
            'Deploy it: run the Omzig Image workflow with deploy=true (or set OMZIG_AUTO_DEPLOY=true).'
    } else {
        Add-Finding OK 'Image' "$ApiApp runs the newest image ($runningTag)."
    }
}

# Log Analytics helper for checks 13-16. The body goes through a temp file because
# `az rest --body` mangles inline JSON on Windows; the query holds no secrets.
function Invoke-CippKql {
    param([Parameter(Mandatory)][string]$Kql)
    $body = (@{ query = $Kql } | ConvertTo-Json -Compress)
    $file = Join-Path ([System.IO.Path]::GetTempPath()) "cipp-kql-$([guid]::NewGuid().ToString('N')).json"
    try {
        Set-Content -Path $file -Value $body -Encoding utf8 -NoNewline
        $url = "https://management.azure.com/subscriptions/$Subscription/resourceGroups/$ResourceGroup" +
               "/providers/Microsoft.OperationalInsights/workspaces/$Workspace/api/query?api-version=2020-08-01"
        $r = Invoke-Az @('rest', '--method', 'POST', '--url', $url, '--body', "@$file",
                         '--headers', 'Content-Type=application/json')
        if ($r -and $r.Tables) { return $r.Tables[0] }
        return $null
    } finally {
        Remove-Item $file -ErrorAction SilentlyContinue
    }
}

# Craft's console log (stdout) reaches Log Analytics as AppServiceConsoleLogs via the Web App's
# diagnostic setting. _ResourceId is lower-case and ends with /sites/<app>.
$ConsoleFilter = "_ResourceId endswith '/sites/$($ApiApp.ToLower())'"

# ------------------------------------ 14. DEPLOYED version (what the app serves, not the repo)
$live = $null
try { $live = Invoke-RestMethod -Uri "https://$ApiApp.azurewebsites.net/version.json" -TimeoutSec 30 } catch { Write-Verbose $_.Exception.Message }
if (-not $live) {
    Add-Finding WARN 'Deployed version' "$ApiApp did not answer /version.json." 'Check the app is running (check 2).'
} elseif ($apiDeployed -and $live.version -ne $apiDeployed) {
    Add-Finding WARN 'Deployed version' "$ApiApp serves $($live.version) (image $($live.tag)) but $Fork main is on $apiDeployed." `
        'A newer image is waiting to be deployed (check 10).'
} else {
    Add-Finding OK 'Deployed version' "$ApiApp serves $($live.version) (image $($live.tag), built $($live.buildDate))."
}

# --------------------------------------------- 15. Background work is really executing
# A scheduler that starts nothing looks healthy from the outside. Craft logs one line when a
# scheduled job starts on a worker and one when it completes.
$bg = Invoke-CippKql @"
AppServiceConsoleLogs
| where TimeGenerated > ago(2h) and $ConsoleFilter
| extend L = tostring(ResultDescription)
| where L has '[Scheduler]' and (L has ' starting on ' or L has ' completed' or L has ' finished')
| extend Fn = extract(@'\] [0-9a-f]+ (\S+) (starting|completed|finished)', 1, L)
| summarize starts = countif(L has ' starting on '), done = countif(L !has ' starting on '), functions = dcount(Fn)
"@
if ($bg -and $bg.Rows.Count -gt 0) {
    $starts = [int]$bg.Rows[0][0]; $done = [int]$bg.Rows[0][1]; $fns = [int]$bg.Rows[0][2]
    if ($starts -eq 0) {
        Add-Finding CRITICAL 'Background' "No scheduled job started on $ApiApp in 2h (expected dozens)." `
            'Background jobs are not running: check the app is Running (2) and the schedule is not paused (19).'
    } elseif ($fns -lt 3) {
        Add-Finding WARN 'Background' "Only $fns distinct scheduled job(s) ran on $ApiApp in 2h ($starts runs)." `
            'Expected the 15-minute CIPP orchestrators as well as the 5-minute jobs. Look for [Scheduler] errors.'
    } else {
        Add-Finding OK 'Background' "$ApiApp started $starts scheduled runs of $fns jobs in 2h; $done completed."
    }
} else {
    Add-Finding WARN 'Background' 'Could not query background activity.' 'Check workspace access.'
}

# --------------------------------------------------------- 16. Container restarts
# Craft logs a startup line each time the container starts. A handful a day is deploys and
# platform maintenance; a stream of them is a crash loop or auto-heal recycling the app.
$rs = Invoke-CippKql @"
AppServiceConsoleLogs
| where TimeGenerated > ago(24h) and $ConsoleFilter
| where tostring(ResultDescription) has 'Container startup attempt'
| summarize starts = count(), lastStart = max(TimeGenerated)
"@
if ($rs -and $rs.Rows.Count -gt 0) {
    $n = [int]$rs.Rows[0][0]
    if ($n -gt 12) {
        Add-Finding WARN 'Restarts' "$ApiApp logged $n container start attempts in 24h, the last at $(([datetime]$rs.Rows[0][1]).ToUniversalTime().ToString('HH:mm'))Z." `
            'Look for a crash loop or auto-heal recycling (health path /api/setup/health) in AppServiceConsoleLogs and AppServicePlatformLogs.'
    } else {
        Add-Finding OK 'Restarts' "$ApiApp logged $n container start attempt(s) in 24h."
    }
}

# --------------------------------------------- 13. Auth error rate from Log Analytics
# lastAuthError is what matters, not the raw count: after a rotation the previous day's
# failures are still in the window but are history. Compare them against the rotation time.
$kql = @"
AppServiceConsoleLogs
| where TimeGenerated > ago(24h) and $ConsoleFilter
| extend Message = tostring(ResultDescription)
| summarize total = count(),
            authErrors = countif(Message has '7000222' or Message has 'invalid_client'),
            errors = countif(Message has 'fail:' or Message has 'crit:' or Message has 'PS error'),
            lastAuthError = maxif(TimeGenerated, Message has '7000222' or Message has 'invalid_client')
"@
$queryBody = (@{ query = $kql } | ConvertTo-Json -Compress)
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) "cipp-kql-$([guid]::NewGuid().ToString('N')).json"
try {
    Set-Content -Path $tmp -Value $queryBody -Encoding utf8 -NoNewline
    $laUrl = "https://management.azure.com/subscriptions/$Subscription/resourceGroups/$ResourceGroup" +
             "/providers/Microsoft.OperationalInsights/workspaces/$Workspace/api/query?api-version=2020-08-01"
    $la = Invoke-Az @('rest', '--method', 'POST', '--url', $laUrl, '--body', "@$tmp",
                      '--headers', 'Content-Type=application/json')
    if ($la -and $la.Tables -and $la.Tables[0].Rows.Count -gt 0) {
        $row = $la.Tables[0].Rows[0]
        $total = $row[0]; $authErr = $row[1]; $err = $row[2]; $lastAuthError = $row[3]

        # When was the secret last rotated? Auth errors older than that are already fixed.
        $rotatedAt = $null
        if ($vaultSecrets) {
            $sec = $vaultSecrets | Where-Object { ($_.id -split '/')[-1] -eq $SecretName }
            if ($sec -and $sec.attributes.updated) { $rotatedAt = ([datetime]$sec.attributes.updated).ToUniversalTime() }
        }
        $lastErrUtc = if ($lastAuthError) { ([datetime]$lastAuthError).ToUniversalTime() } else { $null }
        $errorsArePreRotation = $lastErrUtc -and $rotatedAt -and ($lastErrUtc -lt $rotatedAt)

        if ($total -eq 0) {
            Add-Finding WARN 'Telemetry' "No console log lines from $ApiApp in the last 24h - CIPP may not be running, or its diagnostic setting is gone." `
                "Confirm $ApiApp is running and its diagnostic setting still sends logs to $Workspace."
        } elseif ($authErr -eq 0) {
            Add-Finding OK 'Telemetry' "$total traces / $err error-level in 24h, 0 auth failures."
        } elseif ($errorsArePreRotation) {
            Add-Finding OK 'Telemetry' ("$authErr auth errors in 24h, but the last one was " +
                "$($lastErrUtc.ToString('HH:mm'))Z - before the $($rotatedAt.ToString('HH:mm'))Z rotation. Clean since.")
        } else {
            Add-Finding CRITICAL 'Telemetry' ("$authErr auth (invalid_client) errors in 24h, most recent " +
                "$($lastErrUtc.ToString('yyyy-MM-dd HH:mm'))Z - AFTER the last rotation.") `
                'Rotate the SAM secret: Invoke-CippSecretRotation.ps1'
        }
    } else {
        Add-Finding WARN 'Telemetry' 'Log Analytics query returned no data.' 'Check workspace access.'
    }
} finally {
    Remove-Item $tmp -ErrorAction SilentlyContinue
}

# ------------------------------------- 17. Break-glass sentinel is alive, and its blind spots
# A monitor that stopped running looks exactly like a quiet week. The poller logs one
# summary line per run; its absence is the finding. Tenants without Entra ID P1 (no
# sign-in logs) or whose GDAP role cannot read them are not covered - say so.
$bgRun = Invoke-CippKql @"
AppServiceConsoleLogs
| where TimeGenerated > ago(2h) and $ConsoleFilter
| extend Message = tostring(ResultDescription)
| where Message has 'OmzigSentinel break-glass poll:'
| summarize arg_max(TimeGenerated, Message), runs = count()
| project runs, lastRun = TimeGenerated, lastLine = Message
"@
if ($bgRun -and $bgRun.Rows.Count -gt 0 -and [int]$bgRun.Rows[0][0] -gt 0) {
    $runs = [int]$bgRun.Rows[0][0]
    $summary = $null
    try { $summary = (([string]$bgRun.Rows[0][2]) -replace '^.*?OmzigSentinel break-glass poll:\s*', '') | ConvertFrom-Json } catch {}
    if ($summary) {
        Add-Finding OK 'Break-glass' "Sentinel ran $runs times in 2h; last run checked $($summary.Checked) of $($summary.Tenants) tenants, $($summary.Alerts) alert(s)."
        $blind = @(@($summary.NoSignInLogs) + @($summary.Denied) | Where-Object { $_ })
        if ($blind.Count -gt 0) {
            Add-Finding INFO 'Break-glass' ("Not covered (no sign-in logs or no GDAP read access): " + ($blind -join ', ') + '.')
        }
        if (@($summary.Errors).Count -gt 0) {
            Add-Finding WARN 'Break-glass' "Last run had $(@($summary.Errors).Count) tenant error(s): $((@($summary.Errors) | Select-Object -First 3) -join '; ')" `
                'Transient errors are retried next run; if they persist, check the tenant in CIPP.'
        }
    } else {
        Add-Finding OK 'Break-glass' "Sentinel ran $runs times in 2h."
    }
} elseif ($bgRun) {
    Add-Finding CRITICAL 'Break-glass' "The break-glass sentinel has not run on $ApiApp in 2h (it runs every 5 minutes)." `
        'Check the schedule is not paused (19) and Receive-OmzigSentinelTimer is still in backend/Config/CIPPTimers.json, then look for OmzigSentinel errors in the Logbook.'
}

# ------------------------------------------ 18. GDAP expiry sentinel ran, and what is lapsing
# Relationships holding Global Admin cannot auto-extend and lapse on a fixed date; Wilco's
# did on 2026-08-21 unnoticed. The sentinel runs daily at 13:00 UTC and logs one line.
$gdapRun = Invoke-CippKql @"
AppServiceConsoleLogs
| where TimeGenerated > ago(26h) and $ConsoleFilter
| extend Message = tostring(ResultDescription)
| where Message has 'OmzigSentinel GDAP expiry poll:'
| summarize arg_max(TimeGenerated, Message), runs = count()
| project runs, lastRun = TimeGenerated, lastLine = Message
"@
if ($gdapRun -and $gdapRun.Rows.Count -gt 0 -and [int]$gdapRun.Rows[0][0] -gt 0) {
    $g = $null
    try { $g = (([string]$gdapRun.Rows[0][2]) -replace '^.*?OmzigSentinel GDAP expiry poll:\s*', '') | ConvertFrom-Json } catch {}
    if ($g -and [int]$g.Expiring -gt 0) {
        Add-Finding WARN 'GDAP expiry' "$($g.Expiring) GDAP relationship(s) without auto-extend lapse within 60 days; soonest $($g.Soonest)." `
            'Create the replacement in CIPP (Tenant Administration > GDAP) and have the customer accept it before the end date.'
    } elseif ($g) {
        Add-Finding OK 'GDAP expiry' "Sentinel ran; $($g.Active) active relationship(s), none without auto-extend lapsing within 60 days."
    } else {
        Add-Finding OK 'GDAP expiry' 'Sentinel ran in the last day.'
    }
} elseif ($gdapRun) {
    Add-Finding WARN 'GDAP expiry' "The GDAP expiry sentinel has not run on $ApiApp in 26h (it runs daily at 13:00 UTC)." `
        'Check Receive-OmzigGdapSentinelTimer is still in backend/Config/CIPPTimers.json; to run it now add RunNow/GdapExpiry to OmzigSentinelState.'
}

# ------------------------------------------------ 19. The background schedule is not paused
# Before cutover the app ran with App__Scheduler__ConfigFile pointing at an empty timer file
# (Config/OmzigTimersPaused.json), so it could be verified next to Flex. Left in place,
# nothing scheduled runs: no standards, alerts or sentinels.
if ($settings) {
    $paused = $settings | Where-Object { $_.name -eq 'App__Scheduler__ConfigFile' }
    if ($paused) {
        Add-Finding CRITICAL 'Schedule' "$ApiApp's scheduler reads '$($paused.value)', not CIPP's timer file; standards, alerts and sentinels may not run." `
            "Unless this is deliberate, run: az webapp config appsettings delete -g $ResourceGroup -n $ApiApp --setting-names App__Scheduler__ConfigFile"
    } else {
        Add-Finding OK 'Schedule' "$ApiApp runs CIPP's full timer file."
    }
}

# ---------------------------------------------------- 20. Memory headroom
# One instance runs the portal and all background work. Craft caps the .NET heap at 3 GB
# (DOTNET_GCHeapHardLimit) and recycles each runspace after 250 calls; the plan metric shows
# what the whole instance uses.
$peakPct = $null
if ($ApiSite -and $ApiSite.serverFarmId) {
    $mem = Invoke-Az @('monitor', 'metrics', 'list', '--resource', $ApiSite.serverFarmId, '--metrics', 'MemoryPercentage',
                       '--aggregation', 'Maximum', '--interval', 'PT5M',
                       # --end-time is required: with only --start-time the CLI returns the first hour.
                       '--start-time', (Get-Date).ToUniversalTime().AddHours(-24).ToString('yyyy-MM-ddTHH:mm:ssZ'),
                       '--end-time', (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))
    if ($mem -and $mem.value) {
        $points = @($mem.value[0].timeseries | ForEach-Object { $_.data } | Where-Object { $null -ne $_.maximum } | ForEach-Object { $_.maximum })
        if ($points) { $peakPct = [int](($points | Measure-Object -Maximum).Maximum) }
    }
}
if ($null -eq $peakPct) {
    Add-Finding INFO 'Memory' 'Could not read the plan memory metric.' "Needs Reader on the App Service plan. $(Get-AzErrorSummary)"
} elseif ($peakPct -gt 85) {
    Add-Finding WARN 'Memory' "$ApiApp's plan peaked at $peakPct% memory in the last 24h." `
        'Look for a job that holds large results in memory; consider App__Worker__ pool sizes or a larger plan (runbook).'
} else {
    Add-Finding OK 'Memory' "$ApiApp's plan peaked at $peakPct% memory in 24h."
}

# ------------------------------------------------------------------------ Report
if ($Json) {
    $script:Findings | ConvertTo-Json -Depth 4
} else {
    $order = @{ CRITICAL = 0; WARN = 1; OK = 2; INFO = 3 }
    $script:Findings |
        Sort-Object { $order[$_.Severity] }, Check |
        Format-Table -Wrap -Property Severity, Check, Detail, Action

    $crit = @($script:Findings | Where-Object Severity -eq 'CRITICAL')
    $warn = @($script:Findings | Where-Object Severity -eq 'WARN')

    Write-Host ("=" * 72)
    if ($crit.Count -gt 0) {
        Write-Host "$($crit.Count) CRITICAL, $($warn.Count) WARN - act today." -ForegroundColor Red
    } elseif ($warn.Count -gt 0) {
        Write-Host "$($warn.Count) WARN, 0 CRITICAL - handle this week." -ForegroundColor Yellow
    } else {
        Write-Host 'All green.' -ForegroundColor Green
    }
    Write-Host ''
}

$crit = @($script:Findings | Where-Object Severity -eq 'CRITICAL')
$warn = @($script:Findings | Where-Object Severity -eq 'WARN')
if ($crit.Count -gt 0) { exit 2 } elseif ($warn.Count -gt 0) { exit 1 } else { exit 0 }
