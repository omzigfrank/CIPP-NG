# omzig.ai Portal — Architecture Overview

Omzig-branded fork of CyberDrain's CIPP, per the Omzig Custom CIPP Build spec
v1.1 (2026-07-09, confirmed by Frank Diaz). This document orients a new
contributor; the spec remains the source of truth.

## Repos and overlay pattern (§11.4)

| Repo | Upstream | Overlay root | Patched upstream files |
|---|---|---|---|
| `omzigfrank/CIPP` | `KelvinTegelaar/CIPP` (main) | `src/omzig/*` | `src/theme/colors.js`, `src/theme/utils.js`, `src/pages/_app.js` |
| `omzigfrank/CIPP-API` | `KelvinTegelaar/CIPP-API` (master) | `Modules/Omzig/*` | `profile.ps1` |

Every patched upstream line carries an `omzig.ai overlay` marker comment. The
`omzig-upstream-sync` workflow opens a weekly sync PR in each repo; the CIPP
release train is a release gate — we do not fall off it.

## Azure topology (§11)

Three environments in subscription `48019666-dd78-439e-9890-030ab5156f23`,
deployed by `deployment/omzig` (Bicep, what-if gated):

- **Front Door Premium + WAF** → **Static Web App** (this repo, Next.js)
  → linked **Function App** (CIPP-API, PowerShell 7.4)
- **`omzig-mcp` Container App** (§16.5) beside the Function App
- Key Vault (RBAC, purge protection), Storage (GRS + 6-year WORM audit
  container), Cosmos serverless (§14 containers), Log Analytics/App Insights
- Budget alert $400/mo → 50/75/100% to fdiaz@omzig.it (§17 item 9)
- prod: `dashboard.omzig.it` + `client.dashboard.omzig.it`;
  stage: `stage.dashboard.omzig.it`; dev: Front Door default hostname

## Confirmed configuration quick reference (§17)

- Datto RMM platform: **Vidal** (`DATTO_RMM_PLATFORM=vidal`, overridable)
- PSA: **Autotask primary**, HaloPSA stub behind `PSA_PROVIDER` (§7.14)
- **BAA=true is the default for every tenant** (§17 item 11)
- Break-glass: `bg01@`/`bg02@<initialDomain>` + `omzig:breakglass=true`
  extension attribute (§17 item 12)
- Pax8 secrets are a **blocking** preflight check — deployment halts if
  missing (`Test-OmzigPreflight`, §17 item 5)
- Six GDAP vertical bundles ship day 1: `src/omzig/gdap-bundles/` (§17 item 10)
- AI pricing floors: AIRA $4,000 (never discounted) · AIDF $11,000 ·
  AID $15,500 · MAIO $3,600/mo · 70% margin floor; below-floor quotes need a
  Frank-signed HMAC override token (§3)

## Brand (§5)

Wordmark **omzig.ai** (lowercase, Electric `.ai`; the retired all-caps mark and
the macron U+014C must not return), tagline
`best practice, powered by AI`, Electric `#35B1FF` with the 11-step AAA-safe
scale in `src/omzig/branding/tokens.css`. WCAG 2.2 AAA is the target for both
portals; reduced-motion / reduced-transparency / high-contrast fallbacks are
mandatory and already live in the token sheet.

## Milestone status

Weeks 1–2 scaffolding is in place (branding overlay, GDAP bundles, Bicep,
PSA/RMM adapters, sentinels, pricing engine, tenant records, health score v1,
QC + sync workflows). Weeks 3–6 (single-pane tenant view UI, onboarding
wizard, AI Readiness module UI, REST/GraphQL/CLI/MCP surfaces, AAA hardening
to zero-critical) build on these foundations — see §18 of the spec.
