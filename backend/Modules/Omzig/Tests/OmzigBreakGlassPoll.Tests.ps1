# Pester suite for the break-glass poller, alert dispatcher and Teams card (§7.5).
# Self-contained: CIPP helpers are stubbed, then mocked; nothing touches the network.

BeforeAll {
    # CIPP-API helpers the overlay calls. They are not loaded in a bare test run, and
    # Pester can only mock a command that exists, so define no-op stubs first; their
    # parameter names match the real helpers so the mocks below bind the same way.
    $Stubs = @{
        'Get-CIPPTable'             = '[CmdletBinding()] param($tablename)'
        'Get-CIPPAzDataTableEntity' = '[CmdletBinding()] param($Context, $Filter, $Property, $First, $Skip)'
        'Add-CIPPAzDataTableEntity' = '[CmdletBinding()] param($Context, $Entity, [switch]$Force, [switch]$CreateTableIfNotExists, $OperationType)'
        'Remove-AzDataTableEntity'  = '[CmdletBinding()] param($Context, $Entity)'
        'Get-Tenants'               = '[CmdletBinding()] param([switch]$IncludeAll, [switch]$IncludeErrors, $TenantFilter)'
        'New-GraphGetRequest'       = '[CmdletBinding()] param($uri, $tenantid, $AsApp, $noPagination, $NoAuthCheck)'
        'Write-LogMessage'          = '[CmdletBinding()] param($message, $tenant, $API, $tenantId, $headers, $user, $sev, $LogData)'
        'Send-CIPPAlert'            = '[CmdletBinding()] param($Type, $Title, $HTMLContent, $JSONContent, $TenantFilter, $altEmail, $altWebhook, $APIName)'
        'Get-CippKeyVaultSecret'    = '[CmdletBinding()] param($VaultName, $Name, [switch]$AsPlainText)'
    }
    # Always (re)define: another test file's leftover global stub with a different
    # signature would otherwise be mocked in place of these, and the table mocks below
    # would silently receive an empty -Context (seen on a second run in one session).
    foreach ($Name in $Stubs.Keys) {
        Set-Item -Path "function:global:$Name" -Value ([scriptblock]::Create($Stubs[$Name]))
    }
    Import-Module (Join-Path $PSScriptRoot '..' 'Omzig.psd1') -Force

    $script:Now = [datetime]::new(2026, 10, 1, 12, 0, 0, [DateTimeKind]::Utc)
    $script:Tenant = [pscustomobject]@{ defaultDomainName = 'contoso.com'; customerId = 'cust-1'; initialDomainName = 'contoso.onmicrosoft.com' }
    function global:New-SignIn([string]$Id, [string]$Upn, [int]$ErrorCode = 0, [string]$When = '2026-10-01T11:55:00Z') {
        [pscustomobject]@{ id = $Id; userPrincipalName = $Upn; createdDateTime = $When; appDisplayName = 'Azure Portal'
            ipAddress = '203.0.113.10'; status = [pscustomobject]@{ errorCode = $ErrorCode; failureReason = $(if ($ErrorCode) { 'Invalid password' }) } }
    }
}

AfterAll {
    foreach ($Name in 'Get-CIPPTable', 'Get-CIPPAzDataTableEntity', 'Add-CIPPAzDataTableEntity', 'Remove-AzDataTableEntity',
        'Get-Tenants', 'New-GraphGetRequest', 'Write-LogMessage', 'Send-CIPPAlert', 'Get-CippKeyVaultSecret', 'New-SignIn') {
        Remove-Item -Path "function:global:$Name" -ErrorAction SilentlyContinue
    }
    Remove-Variable -Name BGT -Scope Global -ErrorAction SilentlyContinue
    Remove-Module Omzig -ErrorAction SilentlyContinue
}

Describe 'New-OmzigTeamsCard' {
    It 'builds a Workflows-compatible Adaptive Card message, not the retired { text } body' {
        $Msg = New-OmzigTeamsCard -Title 'T' -Severity 'P1' -Summary 'S' -Facts ([ordered]@{ A = 1; B = 'two' }) -LinkUrl 'https://x'
        $Msg.type | Should -Be 'message'
        $Msg.attachments[0].contentType | Should -Be 'application/vnd.microsoft.card.adaptive'
        $Card = $Msg.attachments[0].content
        $Card.type | Should -Be 'AdaptiveCard'
        $Card.body[0].color | Should -Be 'attention'
        ($Card.body | Where-Object type -EQ 'FactSet').facts.title | Should -Be @('A', 'B')
        $Card.actions[0].url | Should -Be 'https://x'
        $Msg.Keys | Should -Not -Contain 'text'
    }
    It 'serialises to JSON without losing the card' {
        $Json = New-OmzigTeamsCard -Title 'T' | ConvertTo-Json -Depth 20 -Compress
        ($Json | ConvertFrom-Json).attachments[0].content.version | Should -Be '1.4'
    }
}

Describe 'Send-OmzigAlert' {
    BeforeEach {
        Mock -ModuleName Omzig Write-LogMessage { }
        Mock -ModuleName Omzig Send-CIPPAlert { }
        Mock -ModuleName Omzig Invoke-OmzigRestWithRetry { }
        Mock -ModuleName Omzig Get-OmzigPsaClient { [pscustomobject]@{ NewTicket = { param($t) } } }
    }
    It 'sends to Logbook, Teams and email, and the result never contains the webhook URL' {
        Mock -ModuleName Omzig Get-OmzigTeamsWebhook { 'https://example.invalid/webhook/SECRET-TOKEN' }
        $R = Send-OmzigAlert -Severity 'P1' -Title 'T' -Message 'M' -Facts ([ordered]@{ Tenant = 'contoso.com' })
        $R.Logbook | Should -Be 'sent'
        $R.Teams | Should -Be 'sent'
        $R.Email | Should -Match '^sent to '
        $R.Psa | Should -Be 'sent'
        ($R | ConvertTo-Json) | Should -Not -Match 'SECRET-TOKEN'
        Should -Invoke -ModuleName Omzig Invoke-OmzigRestWithRetry -Times 1 -ParameterFilter {
            ($RequestSplat.Body | ConvertFrom-Json).attachments[0].contentType -eq 'application/vnd.microsoft.card.adaptive'
        }
    }
    It 'reports Teams as not configured instead of failing when there is no webhook' {
        Mock -ModuleName Omzig Get-OmzigTeamsWebhook { $null }
        $R = Send-OmzigAlert -Severity 'Test' -Title 'T' -Message 'M' -SkipPsa
        $R.Teams | Should -Be 'not configured'
        $R.Logbook | Should -Be 'sent'
        $R.Psa | Should -Be 'not applicable'
    }
    It 'keeps going when one channel throws' {
        Mock -ModuleName Omzig Get-OmzigTeamsWebhook { 'https://example.invalid/hook' }
        Mock -ModuleName Omzig Invoke-OmzigRestWithRetry { throw 'Teams is down' }
        $R = Send-OmzigAlert -Severity 'P1' -Title 'T' -Message 'M'
        $R.Teams | Should -Match '^failed: Teams is down'
        $R.Email | Should -Match '^sent to '
        $R.Logbook | Should -Be 'sent'
    }
    It 'only opens a PSA ticket for P1' {
        Mock -ModuleName Omzig Get-OmzigTeamsWebhook { $null }
        (Send-OmzigAlert -Severity 'Critical' -Title 'T' -Message 'M').Psa | Should -Be 'not applicable'
    }
}

Describe 'Invoke-OmzigBreakGlassSentinel outcome' {
    It 'flags a failed attempt as FAILED, not as a sign-in' {
        $A = Invoke-OmzigBreakGlassSentinel -TenantFilter 'contoso.com' -InitialDomain 'contoso.onmicrosoft.com' `
            -SignIns @(New-SignIn 'x1' 'bg01@contoso.onmicrosoft.com' 50126) -AlertAction { }
        $A[0].Outcome | Should -Match '^FAILED \(error 50126'
        $A[0].Message | Should -Match 'failed sign-in attempt'
    }
    It 'sends through Send-OmzigAlert when no AlertAction is given' {
        Mock -ModuleName Omzig Send-OmzigAlert { [pscustomobject]@{ Teams = 'sent' } }
        $A = Invoke-OmzigBreakGlassSentinel -TenantFilter 'contoso.com' -InitialDomain 'contoso.onmicrosoft.com' `
            -SignIns @(New-SignIn 'x2' 'bg02@contoso.onmicrosoft.com')
        $A[0].Outcome | Should -Be 'SUCCEEDED'
        $A[0].Delivery.Teams | Should -Be 'sent'
        Should -Invoke -ModuleName Omzig Send-OmzigAlert -Times 1 -ParameterFilter { $Severity -eq 'P1' }
    }
}

Describe 'Invoke-OmzigBreakGlassPoll' {
    BeforeEach {
        $global:BGT = @{}
        $global:BGT.Written = [System.Collections.Generic.List[object]]::new()
        $global:BGT.SeenIds = @()
        $global:BGT.LastChecked = $null
        $global:BGT.WindowRows = @()
        $global:BGT.GraphUris = [System.Collections.Generic.List[string]]::new()
        Mock -ModuleName Omzig Get-CIPPTable { @{ Context = $tablename } }
        Mock -ModuleName Omzig Get-Tenants { @($script:Tenant) }
        Mock -ModuleName Omzig Add-CIPPAzDataTableEntity { $global:BGT.Written.Add($Entity) }
        Mock -ModuleName Omzig Get-CIPPAzDataTableEntity {
            switch ($Context) {
                'OmzigSentinelState' { if ($global:BGT.LastChecked) { [pscustomobject]@{ LastChecked = $global:BGT.LastChecked } } }
                'OmzigBreakGlassSeen' { if ($Filter -match "RowKey eq '([^']+)'" -and $Matches[1] -in $global:BGT.SeenIds) { [pscustomobject]@{ RowKey = $Matches[1] } } }
                'OmzigIncidentWindows' { $global:BGT.WindowRows }
            }
        }
        Mock -ModuleName Omzig Invoke-OmzigBreakGlassSentinel { @($SignIns | ForEach-Object { [pscustomobject]@{ SignInId = $_.id } }) }
        $env:TenantID = $null
    }

    It 'looks back one hour on the first run and filters on the bg01/bg02 accounts' {
        Mock -ModuleName Omzig New-GraphGetRequest { $global:BGT.GraphUris.Add($uri); @() }
        $null = Invoke-OmzigBreakGlassPoll -Now $script:Now
        $Uri = [uri]::UnescapeDataString($global:BGT.GraphUris[0])
        $Uri | Should -Match 'createdDateTime ge 2026-10-01T11:00:00Z'
        $Uri | Should -Match "startsWith\(userPrincipalName,'bg01@'\)"
        $Uri | Should -Match "startsWith\(userPrincipalName,'bg02@'\)"
    }

    It 'reads from the last check minus the overlap afterwards' {
        $global:BGT.LastChecked = '2026-10-01T11:55:00.0000000Z'
        Mock -ModuleName Omzig New-GraphGetRequest { $global:BGT.GraphUris.Add($uri); @() }
        $null = Invoke-OmzigBreakGlassPoll -Now $script:Now -OverlapMinutes 20
        [uri]::UnescapeDataString($global:BGT.GraphUris[0]) | Should -Match 'createdDateTime ge 2026-10-01T11:35:00Z'
    }

    It 'alerts on new sign-ins and records them so the overlap never double-alerts' {
        Mock -ModuleName Omzig New-GraphGetRequest { @(New-SignIn 's1' 'bg01@contoso.onmicrosoft.com'), (New-SignIn 's2' 'bg02@contoso.onmicrosoft.com') }
        $global:BGT.SeenIds = @('s1')
        $R = Invoke-OmzigBreakGlassPoll -Now $script:Now
        $R.SignIns | Should -Be 2
        $R.NewSignIns | Should -Be 1
        Should -Invoke -ModuleName Omzig Invoke-OmzigBreakGlassSentinel -Times 1 -ParameterFilter { $SignIns.Count -eq 1 -and $SignIns[0].id -eq 's2' }
        ($global:BGT.Written | Where-Object { $_.RowKey -eq 's2' }) | Should -Not -BeNullOrEmpty
        ($global:BGT.Written | Where-Object { $_.PartitionKey -eq 'BreakGlass' }).LastResult | Should -Be 'ok'
    }

    It 'passes declared incident windows through, keyed by tenant domain' {
        $global:BGT.WindowRows = @([pscustomobject]@{ PartitionKey = 'contoso.com'; Start = '2026-10-01T11:00:00Z'; End = '2026-10-01T13:00:00Z' })
        Mock -ModuleName Omzig New-GraphGetRequest { @(New-SignIn 's3' 'bg01@contoso.onmicrosoft.com') }
        $null = Invoke-OmzigBreakGlassPoll -Now $script:Now
        Should -Invoke -ModuleName Omzig Invoke-OmzigBreakGlassSentinel -Times 1 -ParameterFilter { $IncidentWindows.Count -eq 1 -and $IncidentWindows[0].TenantId -eq 'contoso.com' }
    }

    It 'reports a tenant without sign-in logs instead of treating it as clean' {
        Mock -ModuleName Omzig New-GraphGetRequest { throw 'Neither tenant is B2C or tenant doesn''t have premium license' }
        $R = Invoke-OmzigBreakGlassPoll -Now $script:Now
        $R.NoSignInLogs | Should -Contain 'contoso.com'
        ($global:BGT.Written | Where-Object { $_.PartitionKey -eq 'BreakGlass' }).LastResult | Should -Match 'Entra ID P1'
    }

    It 'does not advance the checkpoint after a transient error, so the window is re-read' {
        Mock -ModuleName Omzig New-GraphGetRequest { throw 'The operation timed out' }
        $R = Invoke-OmzigBreakGlassPoll -Now $script:Now
        $R.Errors.Count | Should -Be 1
        ($global:BGT.Written | Where-Object { $_.PartitionKey -eq 'BreakGlass' }) | Should -BeNullOrEmpty
    }

    It 'includes the partner tenant, where Omzig''s own break-glass accounts live, reading it with -NoAuthCheck' {
        $env:TenantID = 'partner-tenant-id'
        Mock -ModuleName Omzig New-GraphGetRequest { $global:BGT.GraphUris.Add("$tenantid|$NoAuthCheck"); @() }
        $R = Invoke-OmzigBreakGlassPoll -Now $script:Now
        $R.Tenants | Should -Be 2
        $global:BGT.GraphUris | Should -Contain 'partner-tenant-id|True'
        $global:BGT.GraphUris | Should -Contain 'contoso.com|'
        $env:TenantID = $null
    }

    It 'never counts a tenant as clean when CIPP refuses it with a non-terminating error' {
        # Production 2026-09-23: CIPP Write-Error'd "not in CIPP's tenant list" for the partner
        # tenant; without -ErrorAction Stop that returned nothing and read as "no sign-ins".
        # Behave like the real advanced function: a bare Write-Error only becomes a
        # catchable exception when the caller passes -ErrorAction Stop.
        Mock -ModuleName Omzig New-GraphGetRequest {
            $Msg = "Graph request denied for 'x': the tenant is not in CIPP's tenant list."
            if ($PesterBoundParameters.ErrorAction -eq 'Stop') { throw $Msg } else { Write-Error $Msg -ErrorAction Continue 2>$null }
        }
        $R = Invoke-OmzigBreakGlassPoll -Now $script:Now
        $R.Checked | Should -Be 0
        $R.Errors.Count | Should -Be 1
    }

    It 'reports a GDAP role that cannot read sign-in logs as access denied, not as a transient error' {
        Mock -ModuleName Omzig New-GraphGetRequest { throw 'User is not in the allowed roles' }
        $R = Invoke-OmzigBreakGlassPoll -Now $script:Now
        $R.Denied | Should -Contain 'contoso.com'
        $R.Errors.Count | Should -Be 0
        ($global:BGT.Written | Where-Object { $_.PartitionKey -eq 'BreakGlass' }).LastResult | Should -Match 'access denied'
    }
}

Describe 'Invoke-OmzigSentinelTimerRun self-test' {
    It 'sends a TEST alert once, clears the request and records the result' {
        Mock -ModuleName Omzig Get-CIPPTable { @{ Context = $tablename } }
        Mock -ModuleName Omzig Get-CIPPAzDataTableEntity { if ($Filter -match 'SelfTest') { [pscustomobject]@{ PartitionKey = 'SelfTest'; RowKey = 'Pending'; RequestedBy = 'claude' } } }
        Mock -ModuleName Omzig Invoke-OmzigGdapExpiryPoll { }
        Mock -ModuleName Omzig Send-OmzigAlert { [pscustomobject]@{ Logbook = 'sent'; Teams = 'sent'; Email = 'sent to x'; Psa = 'not applicable' } }
        Mock -ModuleName Omzig Remove-AzDataTableEntity { }
        $global:BGT = @{ Recorded = $null }
        Mock -ModuleName Omzig Add-CIPPAzDataTableEntity { $global:BGT.Recorded = $Entity }
        Mock -ModuleName Omzig Invoke-OmzigBreakGlassPoll { }
        Mock -ModuleName Omzig Invoke-OmzigPortalWarmup { }
        Invoke-OmzigSentinelTimerRun -Timer $null
        Should -Invoke -ModuleName Omzig Send-OmzigAlert -Times 1 -ParameterFilter { $Severity -eq 'Test' -and $SkipPsa }
        Should -Invoke -ModuleName Omzig Remove-AzDataTableEntity -Times 1
        $global:BGT.Recorded.RowKey | Should -Be 'LastResult'
        Should -Invoke -ModuleName Omzig Invoke-OmzigBreakGlassPoll -Times 1
    }
}

Describe 'Craft wiring (CIPP NG): timers and module loading' {
    # Craft's scheduler reads Config/CIPPTimers.json and finds a Command by scanning every .psm1
    # under Modules/ with ^function\s+([\w-]+)\s*\{ (ScriptRepository.FunctionBlockRegex), then
    # runs it in a background runspace, which auto-loads Omzig from its manifest.
    BeforeAll {
        $script:BackendRoot = Join-Path $PSScriptRoot '..' '..' '..'
        $script:Timers = Get-Content (Join-Path $BackendRoot 'Config' 'CIPPTimers.json') -Raw | ConvertFrom-Json
        $script:OmzigTimers = @($Timers | Where-Object { $_.Command -like '*Omzig*' })
        $script:Psm1 = Get-Content (Join-Path $PSScriptRoot '..' 'Omzig.psm1') -Raw
        $script:Manifest = Import-PowerShellDataFile (Join-Path $PSScriptRoot '..' 'Omzig.psd1')
    }

    It 'schedules the break-glass sentinel every 5 minutes and the GDAP sentinel daily at 13:00 UTC' {
        ($OmzigTimers | Where-Object Command -EQ 'Receive-OmzigSentinelTimer').Cron | Should -Be '0 */5 * * * *'
        ($OmzigTimers | Where-Object Command -EQ 'Receive-OmzigGdapSentinelTimer').Cron | Should -Be '0 0 13 * * *'
    }

    It 'writes every Omzig timer command in Omzig.psm1 the way Craft finds it' {
        $OmzigTimers.Count | Should -Be 2
        foreach ($T in $OmzigTimers) {
            $Psm1 | Should -Match ('(?m)^function\s+' + [regex]::Escape($T.Command) + '\s*\{')
            (Get-Module Omzig).ExportedFunctions.Keys | Should -Contain $T.Command
        }
    }

    It 'names every exported function in the manifest, because auto-loading cannot see dot-sourced functions behind a wildcard' {
        $Manifest.FunctionsToExport | Should -Not -Contain '*'
        $Public = Get-ChildItem (Join-Path $PSScriptRoot '..' 'Public') -Filter *.ps1 -Recurse | ForEach-Object BaseName
        $Expected = @($Public) + 'Receive-OmzigSentinelTimer' + 'Receive-OmzigGdapSentinelTimer' | Sort-Object
        @($Manifest.FunctionsToExport | Sort-Object) | Should -Be $Expected
    }

    It 'keeps unique timer ids and 6-field cron expressions in the whole timer file' {
        @($Timers.Id | Sort-Object -Unique).Count | Should -Be @($Timers).Count
        foreach ($T in $Timers) { @($T.Cron -split '\s+').Count | Should -Be 6 -Because $T.Command }
    }
}

Describe 'Invoke-OmzigGdapExpirySentinel auto-extend (§7.6)' {
    It 'raises no expiry finding for a relationship that auto-extends, but does for PT0S' {
        $Now = [datetime]'2026-10-01T00:00:00Z'
        $Rels = @(
            [pscustomobject]@{ id = 'ax'; displayName = 'Auto'; status = 'active'; endDateTime = $Now.AddDays(5); autoExtendDuration = 'P180D'; customer = @{ displayName = 'Contoso' }; accessDetails = @{ unifiedRoles = @() } }
            [pscustomobject]@{ id = 'ga'; displayName = 'GA'; status = 'active'; endDateTime = $Now.AddDays(5); autoExtendDuration = 'PT0S'; customer = @{ displayName = 'Wilco' }; accessDetails = @{ unifiedRoles = @() } }
        )
        $F = @(Invoke-OmzigGdapExpirySentinel -Relationships $Rels -Now $Now)
        $F.Count | Should -Be 1
        $F[0].RelationshipId | Should -Be 'ga'
        $F[0].Customer | Should -Be 'Wilco'
    }
}

Describe 'Invoke-OmzigGdapExpiryPoll' {
    BeforeEach {
        $global:BGT = @{ Alerted = @(); Sent = [System.Collections.Generic.List[object]]::new(); Graph = $null; Written = [System.Collections.Generic.List[object]]::new() }
        $env:TenantID = 'partner-tenant-id'
        Mock -ModuleName Omzig Get-CIPPTable { @{ Context = $tablename } }
        Mock -ModuleName Omzig Get-CIPPAzDataTableEntity { if ($Filter -match "RowKey eq '([^']+)'" -and $Matches[1] -in $global:BGT.Alerted) { [pscustomobject]@{ RowKey = $Matches[1] } } }
        Mock -ModuleName Omzig Add-CIPPAzDataTableEntity { $global:BGT.Written.Add($Entity) }
        Mock -ModuleName Omzig Send-OmzigAlert { $global:BGT.Sent.Add([pscustomobject]@{ Severity = $Severity; Title = $Title }) }
        $script:Now = [datetime]'2026-10-01T00:00:00Z'
        function global:New-Rel([string]$Id, [int]$Days, [string]$Auto = 'PT0S') {
            [pscustomobject]@{ id = $Id; displayName = "Rel $Id"; status = 'active'; endDateTime = $script:Now.AddDays($Days).ToString('o'); autoExtendDuration = $Auto; customer = @{ displayName = "Cust $Id" }; accessDetails = @{ unifiedRoles = @() } }
        }
    }
    AfterEach { $env:TenantID = $null; Remove-Item function:global:New-Rel -ErrorAction SilentlyContinue }

    It 'reads the partner tenant with -NoAuthCheck and -ErrorAction Stop' {
        Mock -ModuleName Omzig New-GraphGetRequest { $global:BGT.Graph = "$tenantid|$NoAuthCheck|$($PesterBoundParameters.ErrorAction)"; @() }
        $null = Invoke-OmzigGdapExpiryPoll -Now $script:Now
        $global:BGT.Graph | Should -Be 'partner-tenant-id|True|Stop'
    }

    It 'escalates severity with the threshold: 45 days Warning, 20 Critical, 5 P1' {
        Mock -ModuleName Omzig New-GraphGetRequest { @((New-Rel 'a' 45), (New-Rel 'b' 20), (New-Rel 'c' 5), (New-Rel 'd' 300)) }
        $R = Invoke-OmzigGdapExpiryPoll -Now $script:Now
        $R.Expiring | Should -Be 3
        $R.Alerted | Should -Be 3
        ($global:BGT.Sent | Where-Object Title -Match 'Cust a').Severity | Should -Be 'Warning'
        ($global:BGT.Sent | Where-Object Title -Match 'Cust b').Severity | Should -Be 'Critical'
        ($global:BGT.Sent | Where-Object Title -Match 'Cust c').Severity | Should -Be 'P1'
        $R.Soonest | Should -Be 'Cust c: 5 days'
    }

    It 'alerts once per threshold, not every day' {
        $global:BGT.Alerted = @('c|7')
        Mock -ModuleName Omzig New-GraphGetRequest { @(New-Rel 'c' 5) }
        $R = Invoke-OmzigGdapExpiryPoll -Now $script:Now
        $R.Expiring | Should -Be 1
        $R.Alerted | Should -Be 0
        $global:BGT.Sent.Count | Should -Be 0
    }

    It 'stays quiet for relationships that auto-extend' {
        Mock -ModuleName Omzig New-GraphGetRequest { @(New-Rel 'x' 3 'P180D') }
        (Invoke-OmzigGdapExpiryPoll -Now $script:Now).Alerted | Should -Be 0
    }

    It 'fails loudly, not "none expiring", when the relationships cannot be read' {
        Mock -ModuleName Omzig New-GraphGetRequest {
            if ($PesterBoundParameters.ErrorAction -eq 'Stop') { throw 'refused' } else { Write-Error 'refused' -ErrorAction Continue 2>$null }
        }
        { Invoke-OmzigGdapExpiryPoll -Now $script:Now } | Should -Throw
    }
}

Describe 'On-demand GDAP run through the 5-minute tick' {
    It 'runs the GDAP poll once when a RunNow row exists, and removes the row' {
        Mock -ModuleName Omzig Get-CIPPTable { @{ Context = $tablename } }
        Mock -ModuleName Omzig Get-CIPPAzDataTableEntity { if ($Filter -match 'RunNow') { [pscustomobject]@{ PartitionKey = 'RunNow'; RowKey = 'GdapExpiry' } } }
        Mock -ModuleName Omzig Remove-AzDataTableEntity { }
        Mock -ModuleName Omzig Invoke-OmzigGdapExpiryPoll { }
        Mock -ModuleName Omzig Invoke-OmzigBreakGlassPoll { }
        Mock -ModuleName Omzig Invoke-OmzigPortalWarmup { }
        Invoke-OmzigSentinelTimerRun -Timer $null
        Should -Invoke -ModuleName Omzig Invoke-OmzigGdapExpiryPoll -Times 1
        Should -Invoke -ModuleName Omzig Remove-AzDataTableEntity -Times 1
        Should -Invoke -ModuleName Omzig Invoke-OmzigBreakGlassPoll -Times 1
    }
}
