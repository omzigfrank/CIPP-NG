/**
 * omzig.ai brand palette — JS mirror of src/omzig/branding/tokens.css.
 * Source of truth: "omzig.ai brand sheet" v1, August 2026.
 *
 *   Ink      #0E1420   carries layouts
 *   Electric #35B1FF   THE accent — wordmark ".ai", links, highlights only
 *   Slate    #8FA3BD   secondary / tagline on dark
 *   White    #FFFFFF   carries layouts
 *
 * The legacy blue #2EA3F2 and the #3088C8 scale extracted from the old logo are
 * both retired. Surface and text values are kept numerically identical to the
 * omzig.ai marketing site (src/index.css) so the portal and the site match
 * exactly rather than merely closely.
 *
 * Contrast notes below are measured, not estimated. Two of them constrain the
 * design and are easy to get wrong:
 *
 *  1. Exact Electric holds 7.80:1 on base Ink but only 6.11:1 on the raised
 *     ink-3 panel, so it is NOT an AAA small-text color. Text uses 400
 *     (#5FC0FF, 7.20:1 worst case) on dark and 800 (#084E88, 7.62:1 worst
 *     case) on light. Exact Electric stays in the wordmark, fills, borders,
 *     focus rings on dark, and display type >=24px.
 *  2. Electric against white is 2.36:1 — below the 3:1 that WCAG 2.4.13 needs
 *     for a focus indicator. The focus ring must therefore be mode-aware; see
 *     `omzigFocusRing`.
 */

/** Electric ramp. 500 is the brand value, exact and unmodified. */
export const omzigScale = {
  50: '#EAF5FF', //  16.68:1 on Ink — AAA
  100: '#D0ECFF', // 15.03:1 on Ink — AAA
  200: '#A9DEFF', // 12.79:1 on Ink — AAA
  300: '#7FD0FF', // 10.85:1 on Ink / 8.51:1 on ink-3 — AAA text on dark
  400: '#5FC0FF', //  9.19:1 on Ink / 7.20:1 on ink-3 — AAA text on dark (small text)
  500: '#35B1FF', //  ELECTRIC — 7.80:1 on Ink, 2.36:1 on white. Non-text + display only.
  600: '#1C90DB', //  3.46:1 on white — non-text (borders, icons) only
  700: '#0F70CC', //  4.99:1 on white — focus ring on light, large text
  800: '#084E88', //  8.55:1 on white / 7.62:1 on p-3 — AAA text on light (links)
  900: '#063A66', // 11.64:1 on white — AAA
  950: '#042A4A', // 14.63:1 on white — AAA (headings, light theme)
}

/** Surfaces and text. Mirrors omzig.ai exactly. */
export const omzigSurfaces = {
  ink: '#0E1420', // brand Ink, exactly — dark background.default
  ink2: '#16202F', // dark cards / panels
  ink3: '#1E2A3D', // dark raised surfaces (worst case for contrast)
  lineDark: '#263449',

  paper: '#FFFFFF', // brand White — light background.default
  paper2: '#F5F7FB',
  paper3: '#EEF2F9',
  lineLight: '#DFE6F0',

  textHiDark: '#F2F6FB', // 13.31:1 on ink-3 — AAA
  textLoDark: '#A9BBD1', //  7.37:1 on ink-3 — AAA (Slate-tinted)
  textHiLight: '#0E1420', // 16.41:1 on p-3 — AAA
  textLoLight: '#43516B', //  7.12:1 on p-3 — AAA

  /* Brand Slate, and the deepened variants for non-text use. Neither raw Slate
     (5.60:1 on ink-3) nor these reach AAA for small text — icons, borders and
     dividers only, where the 3:1 non-text threshold applies. */
  slate: '#8FA3BD',
  slateDark: '#9DB0C9', // icons/borders on dark
  slateLight: '#3D5470', // icons/borders on light
}

/**
 * Semantic colors. The brand has no teal, green or violet, so these are held to
 * the minimum needed for status meaning and never used as decoration.
 * Each is AAA for text in the mode it is named for.
 */
export const omzigSemantic = {
  successDark: '#6EE7C8',
  successLight: '#0F6E56',
  warnDark: '#FAC775',
  warnLight: '#854F0B',
  dangerDark: '#FA9797',
  dangerLight: '#9E1B1B',
  info: omzigScale[500],
}

/** Semantic colors resolved for one mode, so callers never pick the wrong half. */
export const omzigSemanticFor = (dark) => ({
  success: dark ? omzigSemantic.successDark : omzigSemantic.successLight,
  warn: dark ? omzigSemantic.warnDark : omzigSemantic.warnLight,
  danger: dark ? omzigSemantic.dangerDark : omzigSemantic.dangerLight,
  info: dark ? omzigScale[400] : omzigScale[800],
})

/** Focus indicator — WCAG 2.4.13 needs >=3:1 against adjacent colors.
 *  Electric manages 7.80:1 on Ink but only 2.36:1 on white, so light mode
 *  steps down the ramp to 700 (4.99:1). */
export const omzigFocusRing = { dark: omzigScale[500], light: omzigScale[700] }

/**
 * MUI primary preset — consumed by src/theme/colors.js as the `omzig` preset,
 * which getPrimary() feeds into palette.primary for BOTH modes.
 *
 * That single-object constraint is why `main` is not exact Electric. Three
 * requirements have to hold at once for a filled primary button:
 *   - label vs fill  >= 7:1   (WCAG 1.4.6 AAA text)
 *   - fill vs page   >= 3:1   (WCAG 1.4.11 non-text, the button's own edge)
 * Exact Electric fails both against white (2.36:1). Stop 800 clears them on
 * light (8.55:1 both ways), so it is the safe shared default.
 *
 * Dark mode then upgrades to a true Electric fill via `omzigPrimary(true)`,
 * which the brand overlay merges last — see src/omzig/branding/theme.js.
 */
export const omzigMuiPreset = {
  lightest: omzigScale[50],
  light: omzigScale[400],
  main: omzigScale[800], // white label 8.55:1, edge vs white 8.55:1 — AAA both
  dark: omzigScale[900],
  darkest: omzigScale[950],
  contrastText: '#FFFFFF',
}

/**
 * Mode-aware primary. Dark mode gets the brand's actual Electric as the fill
 * with Ink as the label (7.80:1 AAA); its edge against the raised ink-3 panel
 * is 6.11:1, so 1.4.11 is satisfied too. Light mode keeps the 800 default.
 *
 * Returns the alpha channels as well, because MUI components read
 * palette.primary.alpha4/8/12/30/50 and a partial override would drop them.
 */
export const omzigPrimary = (dark) => {
  const main = dark ? omzigScale[500] : omzigScale[800]
  return {
    lightest: omzigScale[50],
    light: dark ? omzigScale[300] : omzigScale[400],
    main,
    dark: dark ? omzigScale[700] : omzigScale[900],
    darkest: omzigScale[950],
    contrastText: dark ? omzigSurfaces.ink : '#FFFFFF',
    alpha4: `rgba(53, 177, 255, 0.04)`,
    alpha8: `rgba(53, 177, 255, 0.08)`,
    alpha12: `rgba(53, 177, 255, 0.12)`,
    alpha30: `rgba(53, 177, 255, 0.3)`,
    alpha50: `rgba(53, 177, 255, 0.5)`,
  }
}

/** Electric fill + the only text color allowed on top of it (7.80:1). */
export const omzigElectricFill = { bg: omzigScale[500], fg: omzigSurfaces.ink }

/* ---------- Wordmark ----------
 * Brand sheet: always lowercase, always with the Electric ".ai". Never set in
 * Calibri, never all caps. The previous all-caps mark and any macron over the O
 * (U+014C) are retired for trademark reasons — do not reintroduce either.
 */
export const OMZIG_WORDMARK = 'omzig'
export const OMZIG_WORDMARK_SUFFIX = '.ai'
export const OMZIG_WORDMARK_FULL = 'omzig.ai'
export const OMZIG_TAGLINE = 'best practice, powered by AI'

/** Tagline color per the sheet: Slate on dark, #5A6B82 on light. */
export const OMZIG_TAGLINE_COLOR = { dark: omzigSurfaces.slate, light: '#5A6B82' }

/* ---------- Type ----------
 * Space Grotesk (Google Fonts) for the wordmark and headlines; Calibri for body
 * copy. Carlito is metric-compatible with Calibri and ships on Linux, so it
 * backs Calibri up for admins not on Windows.
 */
export const OMZIG_FONT_DISPLAY =
  "'Space Grotesk', 'Segoe UI', ui-sans-serif, system-ui, sans-serif"
export const OMZIG_FONT_BODY =
  "'Calibri', 'Carlito', 'Segoe UI', ui-sans-serif, system-ui, sans-serif"
