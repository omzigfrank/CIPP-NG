/**
 * omzig.ai page hero — the signature banner for omzig.ai-native pages (§8.1).
 *
 * A liquid-glass panel over an animated aurora: two drifting brand-blue /
 * teal glow orbs, a conic sheen sweeping the top hairline, the wordmark
 * eyebrow, and a gradient display title. Animations are tagged with
 * data-omzig-motion and also killed globally under prefers-reduced-motion
 * by the theme overlay.
 */

import PropTypes from 'prop-types'
import { Box, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { omzigScale } from './palette'
import { OMZIG_WORDMARK, OMZIG_TAGLINE } from './palette'
import { OmzigAuroraCanvas } from './OmzigAuroraCanvas'

export const OmzigPageHero = (props) => {
  const { title, subtitle, actions = null, children = null } = props

  return (
    <Box
      data-omzig-motion
      sx={(theme) => {
        const dark = theme.palette.mode === 'dark'
        return {
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 3,
          px: { xs: 2.5, md: 4 },
          py: { xs: 2.5, md: 4 },
          border: `1px solid ${alpha(omzigScale[400], dark ? 0.2 : 0.28)}`,
          backgroundColor: dark ? '#0E1420' : omzigScale[950],
          backgroundImage: [
            `radial-gradient(620px 260px at 8% -30%, ${alpha(omzigScale[500], 0.38)}, transparent 65%)`,
            `radial-gradient(520px 240px at 92% 130%, ${alpha('#7FD0FF', 0.22)}, transparent 62%)`,
            `linear-gradient(120deg, #0E1420 0%, ${omzigScale[900]} 55%, #16202F 100%)`,
          ].join(', '),
          boxShadow: `inset 0 1px 0 ${alpha('#FFFFFF', 0.07)}, 0 18px 44px -20px ${alpha(
            omzigScale[500],
            0.45
          )}`,
          animation: 'omzigFadeUp 480ms ease both',
          // Sweeping sheen along the top hairline.
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            backgroundImage: `linear-gradient(90deg, transparent, ${alpha(
              omzigScale[300],
              0.9
            )}, ${alpha('#7FD0FF', 0.9)}, transparent)`,
            backgroundSize: '50% 100%',
            backgroundRepeat: 'no-repeat',
            animation: 'omzigSheen 7s linear infinite',
          },
          // Drifting aurora orb.
          '&::after': {
            content: '""',
            position: 'absolute',
            width: 420,
            height: 420,
            right: '-8%',
            top: '-55%',
            pointerEvents: 'none',
            background: `radial-gradient(circle at center, ${alpha(
              omzigScale[400],
              0.28
            )} 0%, transparent 60%)`,
            animation: 'omzigAuroraDrift 14s ease-in-out infinite',
          },
        }
      }}
    >
      {/* Living WebGL aurora — parallaxes to the pointer, degrades to the CSS
          backdrop above under reduced motion / no WebGL. */}
      <OmzigAuroraCanvas />
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems={{ xs: 'flex-start', md: 'center' }}
        justifyContent="space-between"
        sx={{ position: 'relative', zIndex: 1 }}
      >
        <Box>
          <Typography
            variant="overline"
            sx={{
              color: alpha('#FFFFFF', 0.66),
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              '&::before': {
                content: '""',
                width: 26,
                height: 2,
                borderRadius: 1,
                background: `linear-gradient(90deg, ${omzigScale[400]}, #7FD0FF)`,
                display: 'inline-block',
              },
            }}
          >
            {OMZIG_WORDMARK} · {OMZIG_TAGLINE}
          </Typography>
          <Typography
            variant="h4"
            component="h1"
            data-omzig-motion
            sx={{
              mt: 0.5,
              // Animated gradient shimmer sweeping the display title.
              backgroundImage: `linear-gradient(100deg, #FFFFFF 0%, ${omzigScale[200]} 40%, #A9DEFF 55%, ${omzigScale[200]} 70%, #FFFFFF 100%)`,
              backgroundSize: '250% 100%',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              WebkitTextFillColor: 'transparent',
              animation: 'omzigTitleSheen 9s ease-in-out infinite',
              '@keyframes omzigTitleSheen': {
                '0%, 100%': { backgroundPosition: '0% 50%' },
                '50%': { backgroundPosition: '100% 50%' },
              },
            }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" sx={{ mt: 1, maxWidth: 640, color: alpha('#FFFFFF', 0.72) }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions && (
          <Box sx={{ flexShrink: 0, width: { xs: '100%', md: 'auto' } }}>{actions}</Box>
        )}
      </Stack>
      {children && (
        <Box sx={{ position: 'relative', zIndex: 1, mt: 2.5 }}>{children}</Box>
      )}
    </Box>
  )
}

OmzigPageHero.propTypes = {
  title: PropTypes.node.isRequired,
  subtitle: PropTypes.node,
  actions: PropTypes.node,
  children: PropTypes.node,
}
