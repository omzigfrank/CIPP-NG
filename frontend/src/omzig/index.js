/**
 * omzig.ai overlay entry point.
 *
 * Everything Omzig-specific in the frontend lives under src/omzig/*.
 * Upstream files are only patched where upstream lacks an extension point
 * (currently: color-preset registration in src/theme). See src/omzig/README.md
 * for the overlay rules before touching anything outside this directory.
 */

export {
  omzigScale,
  omzigSurfaces,
  omzigSemantic,
  omzigMuiPreset,
  OMZIG_WORDMARK,
  OMZIG_TAGLINE,
} from './branding/palette'
export { OMZIG_TIERS, getTier } from './config/tiers'
export {
  OMZIG_AI_PRODUCTS,
  OMZIG_COST_BASELINES,
  OMZIG_AI_STATUSES,
  getAiProduct,
} from './config/aiProducts'
export { OMZIG_VERTICALS, getVertical } from './config/verticals'
export { OMZIG_GDAP_BUNDLES } from './gdap-bundles/index.js'
export {
  createOmzigOverlayOptions,
  omzigGradientTextSx,
  omzigGlassSx,
} from './branding/theme'
export { OmzigPageHero } from './branding/OmzigPageHero'
// Signature interaction layer.
export { OmzigAuroraCanvas } from './branding/OmzigAuroraCanvas'
export { AnimatedNumber } from './branding/AnimatedNumber'
export { RadialGauge } from './branding/RadialGauge'
export { ProgressRing } from './branding/ProgressRing'
export { OmzigReveal } from './branding/OmzigReveal'
export { TiltCard } from './branding/TiltCard'
export { usePrefersReducedMotion, useCountUp, useInView } from './branding/motion'
