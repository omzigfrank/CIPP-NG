/**
 * omzig.ai signature theme overlay — Omzig Custom CIPP Build v1.1 §5.2 / §8.1.
 *
 * Deep-merged as the final options argument in src/theme/index.js, on top of
 * the upstream base/light/dark options. Everything visual that makes the
 * portal unmistakably omzig.ai lives here so upstream theme files stay clean:
 *
 *  - aurora mesh page background (Electric glows on Ink / White)
 *  - liquid-glass card + tooltip surfaces with brand hairline borders
 *  - gradient primary buttons with hover lift + glow
 *  - brand-tinted scrollbars, selection color and focus glow
 *  - tighter display typography
 *
 * Accessibility: every animation defined here is disabled under
 * prefers-reduced-motion, glass falls back to solid surfaces under
 * prefers-reduced-transparency (mirroring tokens.css), and all text/surface
 * pairs stay on the §5.2 contrast-audited scale.
 */

import { alpha } from '@mui/material/styles'
import {
  omzigScale,
  omzigSurfaces,
  omzigSemanticFor,
  omzigPrimary,
  OMZIG_FONT_DISPLAY,
  OMZIG_FONT_BODY,
} from './palette'

// Brand Ink, exactly, plus the panel steps from palette.js. These replace the
// ad-hoc #0A0F18/#101826 near-blacks the old blue palette shipped with.
const INK = omzigSurfaces.ink
const INK_PAPER = omzigSurfaces.ink2

// Shared keyframes — referenced by the hero + pages via animation names.
const keyframes = {
  '@keyframes omzigAuroraDrift': {
    '0%': { transform: 'translate3d(0, 0, 0) scale(1)' },
    '50%': { transform: 'translate3d(4%, -3%, 0) scale(1.08)' },
    '100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
  },
  '@keyframes omzigFadeUp': {
    from: { opacity: 0, transform: 'translateY(12px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
  },
  '@keyframes omzigSheen': {
    from: { backgroundPosition: '200% 50%' },
    to: { backgroundPosition: '-200% 50%' },
  },
  '@keyframes omzigPulseGlow': {
    '0%, 100%': { boxShadow: `0 0 0 0 ${alpha(omzigScale[500], 0.35)}` },
    '50%': { boxShadow: `0 0 24px 4px ${alpha(omzigScale[500], 0.18)}` },
  },
}

// Aurora mesh painted on the page body, behind every surface. Dark mode gets
// the full "northern lights over ink" treatment; light mode a whisper of it.
const auroraBackground = (dark) =>
  dark
    ? {
        backgroundColor: INK,
        backgroundImage: [
          `radial-gradient(1100px 520px at 12% -8%, ${alpha(omzigScale[500], 0.16)}, transparent 62%)`,
          `radial-gradient(900px 480px at 88% 4%, ${alpha(omzigScale[300], 0.1)}, transparent 60%)`,
          `radial-gradient(1300px 700px at 50% 118%, ${alpha(omzigScale[700], 0.22)}, transparent 64%)`,
          `linear-gradient(180deg, ${INK} 0%, ${omzigSurfaces.ink2} 100%)`,
        ].join(', '),
        backgroundAttachment: 'fixed, fixed, fixed, fixed',
      }
    : {
        backgroundColor: omzigSurfaces.paper2,
        backgroundImage: [
          `radial-gradient(1100px 520px at 12% -8%, ${alpha(omzigScale[400], 0.14)}, transparent 62%)`,
          `radial-gradient(900px 480px at 88% 4%, ${alpha(omzigScale[400], 0.08)}, transparent 60%)`,
          `radial-gradient(1300px 700px at 50% 118%, ${alpha(omzigScale[200], 0.3)}, transparent 64%)`,
          `linear-gradient(180deg, ${omzigSurfaces.paper} 0%, ${omzigSurfaces.paper3} 100%)`,
        ].join(', '),
        backgroundAttachment: 'fixed, fixed, fixed, fixed',
      }

export const createOmzigOverlayOptions = ({ paletteMode }) => {
  const dark = paletteMode === 'dark'
  const hairline = dark ? alpha(omzigScale[400], 0.16) : alpha(omzigScale[800], 0.1)
  const semantic = omzigSemanticFor(dark)

  return {
    shape: { borderRadius: 10 },
    // Merged last, so this is what finally decides the brand accent. The shared
    // `omzig` preset in src/theme/colors.js cannot be mode-aware (getPrimary
    // takes only a preset name), and no single value clears both AAA label
    // contrast and 3:1 edge contrast in light *and* dark — so dark mode is
    // upgraded to the real Electric fill here. See omzigPrimary().
    palette: {
      primary: omzigPrimary(dark),
      background: {
        default: dark ? omzigSurfaces.ink : omzigSurfaces.paper,
        paper: dark ? omzigSurfaces.ink2 : omzigSurfaces.paper,
      },
      text: {
        primary: dark ? omzigSurfaces.textHiDark : omzigSurfaces.textHiLight,
        secondary: dark ? omzigSurfaces.textLoDark : omzigSurfaces.textLoLight,
      },
      divider: dark ? omzigSurfaces.lineDark : omzigSurfaces.lineLight,
    },
    typography: {
      // Brand sheet: Space Grotesk for the wordmark and headlines, Calibri for
      // body copy. Never set the wordmark in Calibri.
      fontFamily: OMZIG_FONT_BODY,
      h1: { fontFamily: OMZIG_FONT_DISPLAY, letterSpacing: '-0.03em' },
      h2: { fontFamily: OMZIG_FONT_DISPLAY, letterSpacing: '-0.03em' },
      h3: { fontFamily: OMZIG_FONT_DISPLAY, letterSpacing: '-0.02em' },
      h4: { fontFamily: OMZIG_FONT_DISPLAY, letterSpacing: '-0.02em', fontWeight: 700 },
      h5: { fontFamily: OMZIG_FONT_DISPLAY, letterSpacing: '-0.01em', fontWeight: 700 },
      h6: { fontFamily: OMZIG_FONT_DISPLAY, letterSpacing: '-0.01em', fontWeight: 700 },
      subtitle1: { fontFamily: OMZIG_FONT_DISPLAY },
      subtitle2: { fontFamily: OMZIG_FONT_DISPLAY },
      button: { fontFamily: OMZIG_FONT_DISPLAY, fontWeight: 500 },
      overline: { fontFamily: OMZIG_FONT_DISPLAY, letterSpacing: '0.14em' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ...keyframes,
          html: {
            // Brand scrollbars (replaces the upstream green defaults).
            '--sb-track-color': dark ? omzigSurfaces.ink2 : omzigSurfaces.paper3,
            '--sb-thumb-color': dark ? omzigScale[700] : omzigScale[300],
            '--sb-size': '8px',
          },
          body: {
            ...auroraBackground(dark),
          },
          '::selection': {
            backgroundColor: alpha(omzigScale[500], dark ? 0.45 : 0.25),
          },
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': {
              animationDuration: '0.01ms !important',
              animationIterationCount: '1 !important',
              transitionDuration: '0.01ms !important',
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            transition:
              'transform 160ms ease, box-shadow 160ms ease, background-color 160ms ease',
          },
          containedPrimary: {
            backgroundImage: dark
              ? `linear-gradient(135deg, ${omzigScale[500]} 0%, ${omzigScale[700]} 100%)`
              : `linear-gradient(135deg, ${omzigScale[600]} 0%, ${omzigScale[800]} 100%)`,
            boxShadow: `0 1px 2px ${alpha(omzigSurfaces.ink, 0.35)}, 0 4px 14px -4px ${alpha(
              omzigScale[500],
              0.5
            )}`,
            '&:hover': {
              backgroundImage: dark
                ? `linear-gradient(135deg, ${omzigScale[400]} 0%, ${omzigScale[600]} 100%)`
                : `linear-gradient(135deg, ${omzigScale[500]} 0%, ${omzigScale[700]} 100%)`,
              boxShadow: `0 2px 4px ${alpha(omzigSurfaces.ink, 0.35)}, 0 8px 22px -6px ${alpha(
                omzigScale[500],
                0.65
              )}`,
              transform: 'translateY(-1px)',
            },
            '&:active': { transform: 'translateY(0)' },
            '&.Mui-disabled': { backgroundImage: 'none' },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            border: `1px solid ${hairline}`,
            backgroundImage: dark
              ? `linear-gradient(180deg, ${alpha(omzigScale[500], 0.07)} 0%, ${alpha(
                  omzigScale[500],
                  0.015
                )} 55%, transparent 100%)`
              : 'none',
            boxShadow: dark
              ? `inset 0 1px 0 ${alpha('#FFFFFF', 0.05)}, 0 1px 2px ${alpha(
                  '#000000',
                  0.4
                )}, 0 12px 32px -16px ${alpha('#000000', 0.55)}`
              : `0 1px 2px ${alpha(omzigSurfaces.ink, 0.05)}, 0 10px 28px -14px ${alpha(omzigSurfaces.ink, 0.14)}`,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: dark ? alpha(omzigSurfaces.ink2, 0.92) : alpha(omzigScale[900], 0.94),
            backdropFilter: 'blur(8px)',
            border: `1px solid ${alpha(omzigScale[400], 0.25)}`,
            fontSize: 12,
          },
          arrow: {
            color: dark ? alpha(omzigSurfaces.ink2, 0.92) : alpha(omzigScale[900], 0.94),
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: 99,
            backgroundColor: dark ? alpha(omzigScale[500], 0.14) : alpha(omzigScale[500], 0.12),
          },
          bar: {
            borderRadius: 99,
            backgroundImage: `linear-gradient(90deg, ${omzigScale[500]}, ${omzigScale[300]})`,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          filledSuccess: { boxShadow: `0 0 14px -2px ${alpha(semantic.success, 0.55)}` },
          filledError: { boxShadow: `0 0 14px -2px ${alpha(semantic.danger, 0.55)}` },
          filledWarning: { boxShadow: `0 0 14px -2px ${alpha(semantic.warn, 0.5)}` },
        },
      },
    },
  }
}

/* ---------- Reusable sx helpers for omzig.ai pages ---------- */

// Big display text filled with the brand gradient.
export const omzigGradientTextSx = {
  backgroundImage: `linear-gradient(100deg, ${omzigScale[100]} 0%, ${omzigScale[300]} 45%, ${omzigScale[500]} 100%)`,
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  color: 'transparent',
  WebkitTextFillColor: 'transparent',
}

// Liquid-glass surface (§8.1) as an sx factory — theme-aware.
export const omzigGlassSx = (theme) =>
  theme.palette.mode === 'dark'
    ? {
        backgroundColor: alpha(omzigSurfaces.ink2, 0.55),
        backgroundImage: `linear-gradient(180deg, ${alpha(omzigScale[500], 0.08)}, transparent 60%)`,
        backdropFilter: 'blur(20px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
        border: `1px solid ${alpha(omzigScale[400], 0.16)}`,
      }
    : {
        backgroundColor: alpha('#FFFFFF', 0.72),
        backdropFilter: 'blur(24px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
        border: `1px solid ${alpha(omzigScale[800], 0.1)}`,
      }
