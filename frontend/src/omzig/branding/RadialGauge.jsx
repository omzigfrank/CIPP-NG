/**
 * omzig.ai radial gauge — a dependency-free SVG arc that fills to `value`
 * (0..1) with an animated sweep and a gradient stroke, showing the percentage
 * in the centre. Used for the quote engine's gross-margin readout.
 */
import PropTypes from 'prop-types'
import { Box, Typography } from '@mui/material'
import { useCountUp } from './motion'

export const RadialGauge = ({
  value = 0,
  size = 132,
  thickness = 10,
  accent = '#35B1FF',
  track = 'rgba(148,163,184,0.22)',
  label,
  sublabel,
  duration = 1100,
}) => {
  const clamped = Math.max(0, Math.min(1, Number(value) || 0))
  const animated = useCountUp(clamped, { duration })
  const r = (size - thickness) / 2
  const cx = size / 2
  // 270° arc starting bottom-left.
  const startAngle = 135
  const sweep = 270
  const circumference = 2 * Math.PI * r
  const arcLen = (sweep / 360) * circumference
  const dash = arcLen * animated
  const gid = `omzig-gauge-${Math.round(accent.replace('#', '') ? parseInt(accent.slice(1), 16) : 0)}`

  return (
    <Box sx={{ position: 'relative', width: size, height: size, mx: 'auto' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label ? `${label}: ${Math.round(clamped * 100)}%` : `${Math.round(clamped * 100)}%`}>
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.65" />
            <stop offset="100%" stopColor={accent} />
          </linearGradient>
        </defs>
        <g transform={`rotate(${startAngle} ${cx} ${cx})`}>
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke={track}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${arcLen} ${circumference}`}
          />
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke={`url(#${gid})`}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            style={{ filter: `drop-shadow(0 0 6px ${accent}66)` }}
          />
        </g>
      </svg>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="h5" sx={{ fontVariantNumeric: 'tabular-nums', color: accent, lineHeight: 1 }}>
          {(animated * 100).toFixed(1)}%
        </Typography>
        {label && (
          <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4, mt: 0.5 }}>
            {label}
          </Typography>
        )}
        {sublabel && (
          <Typography variant="caption" color="text.secondary">
            {sublabel}
          </Typography>
        )}
      </Box>
    </Box>
  )
}

RadialGauge.propTypes = {
  value: PropTypes.number,
  size: PropTypes.number,
  thickness: PropTypes.number,
  accent: PropTypes.string,
  track: PropTypes.string,
  label: PropTypes.node,
  sublabel: PropTypes.node,
  duration: PropTypes.number,
}
