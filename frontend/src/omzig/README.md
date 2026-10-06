# omzig.ai Overlay — Frontend

This directory holds every Omzig-specific addition to the CIPP frontend, per the
overlay pattern in the Omzig Custom CIPP Build spec (§11.4):

> All Omzig customizations live in `src/omzig/*` and `Modules/Omzig/*` — never
> patch upstream files unless upstream lacks an extension point (in which case,
> an upstream PR is opened).

## Contents

| Path | Purpose |
|---|---|
| `branding/tokens.css` | Brand CSS variables (§5.2), liquid-glass surfaces, WCAG fallbacks (§8.3) |
| `branding/palette.js` | JS palette mirror + MUI `omzig` color preset |
| `config/tiers.js` | Omzig service tier catalog (§3) |
| `config/aiProducts.js` | AIRA / AIDF / AID / MAIO catalog with pricing floors (§3, §7.7) |
| `config/verticals.js` | Industry verticals → GDAP bundle mapping (§14) |
| `gdap-bundles/*.json` | Six vertical GDAP role bundles (§6.1, §17 item 10) |

## Upstream files intentionally patched

Kept to the absolute minimum; each patch is marked with an `omzig.ai overlay` comment:

1. `src/theme/colors.js` — adds the `omzig` color export (preset registration has
   no extension point upstream).
2. `src/theme/utils.js` — adds the `omzig` case to `getPrimary`.
3. `src/pages/_app.js` — imports `src/omzig/branding/tokens.css` and switches the
   hardcoded `colorPreset` to `omzig`.

When syncing upstream (weekly `omzig-upstream-sync` workflow), conflicts should
only ever appear in those three files.

## Rules

- The wordmark is **omzig.ai** — always lowercase, always with the Electric `.ai`.
  Never all caps, never in Calibri, and never with a macron over the O (U+014C):
  the previous all-caps mark was retired for trademark reasons.
- Tagline: `best practice, powered by AI` — footer of every page and generated
  PDF. Per the brand sheet it is optional and must never be reworded or
  restyled. Note its brand colors are AA, not AAA — see OmzigLogo.jsx.
- Electric `#35B1FF` is not AAA for small text (6.11:1 on the raised ink-3
  panel) and is only 2.36:1 on white. Use `--omzig-electric-400` on dark and
  `--omzig-electric-800`
  or darker there. Full use rules are in `branding/tokens.css`.
- GDAP bundles carry well-known Entra role template IDs; review against the
  current CIPP recommended-roles list before each deploy wave.
