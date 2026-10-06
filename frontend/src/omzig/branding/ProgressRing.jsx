/**
 * omzig.ai progress ring — a compact animated circular progress indicator
 * (e.g. "N of M bundles imported"). Gradient stroke, centre caption.
 */
import PropTypes from 'prop-types'
import { Box, Typography } from '@mui/material'
import { useCountUp } from './motion'

export const ProgressRing = ({
  value = 0,
  size = 84,
  thickness = 8,
  from = '#35B1FF',
  to = '#16B8A6',
  centerLabel,
  duration = 1100,
}) => {
  const clamped = Math.max(0, Math.min(1, Number(value) || 0))
  const animated = useCountUp(clamped, { duration })
  const r = (size - thickness) / 2
  const c = size / 2
  const circumference = 2 * Math.PI * r
  const gid = `omzig-ring-${from.replace('#', '')}-${to.replace('#', '')}`

  return (
    <Box sx={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${Math.round(clamped * 100)}%`}>
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(148,163,184,0.22)" strokeWidth={thickness} />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${circumference * animated} ${circumference}`}
          transform={`rotate(-90 ${c} ${c})`}
          style={{ filter: `drop-shadow(0 0 5px ${from}55)` }}
        />
      </svg>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="subtitle1" sx={{ fontVariantNumeric: 'tabular-nums', color: '#FFFFFF', lineHeight: 1 }}>
          {centerLabel ?? `${Math.round(animated * 100)}%`}
        </Typography>
      </Box>
    </Box>
  )
}

ProgressRing.propTypes = {
  value: PropTypes.number,
  size: PropTypes.number,
  thickness: PropTypes.number,
  from: PropTypes.string,
  to: PropTypes.string,
  centerLabel: PropTypes.node,
  duration: PropTypes.number,
}
