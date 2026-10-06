/**
 * omzig.ai tilt card — a pointer-reactive 3D tilt + moving specular glare on
 * hover, giving the channel / bundle cards physical depth. Disabled entirely
 * under reduced motion and on touch (no hover), where it renders a plain Box.
 */
import { useRef } from 'react'
import PropTypes from 'prop-types'
import { Box } from '@mui/material'
import { usePrefersReducedMotion } from './motion'

export const TiltCard = ({ children, max = 6, glare = true, sx, ...rest }) => {
  const reduced = usePrefersReducedMotion()
  const ref = useRef(null)
  const glareRef = useRef(null)
  const raf = useRef(null)

  const canTilt =
    !reduced && typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches

  const onMove = (e) => {
    if (!canTilt) return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    const rx = (0.5 - py) * max
    const ry = (px - 0.5) * max
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translate3d(0,0,0)`
      if (glareRef.current) {
        glareRef.current.style.opacity = '1'
        glareRef.current.style.background = `radial-gradient(circle at ${px * 100}% ${py * 100}%, rgba(255,255,255,0.18), transparent 45%)`
      }
    })
  }
  const reset = () => {
    const el = ref.current
    if (!el) return
    cancelAnimationFrame(raf.current)
    el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)'
    if (glareRef.current) glareRef.current.style.opacity = '0'
  }

  return (
    <Box
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      sx={{
        position: 'relative',
        transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        transformStyle: 'preserve-3d',
        height: '100%',
        ...sx,
      }}
      {...rest}
    >
      {children}
      {glare && canTilt && (
        <Box
          ref={glareRef}
          aria-hidden="true"
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            opacity: 0,
            transition: 'opacity 220ms ease',
            pointerEvents: 'none',
            mixBlendMode: 'soft-light',
          }}
        />
      )}
    </Box>
  )
}

TiltCard.propTypes = {
  children: PropTypes.node,
  max: PropTypes.number,
  glare: PropTypes.bool,
  sx: PropTypes.object,
}
