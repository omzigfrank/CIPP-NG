/**
 * omzig.ai scroll-reveal — fades + lifts its children into place the first time
 * they enter the viewport, with an optional stagger `delay`. Content starts
 * visible under reduced motion or without IntersectionObserver, and a safety
 * timeout guarantees it can never stay hidden.
 */
import PropTypes from 'prop-types'
import { Box } from '@mui/material'
import { useInView } from './motion'

export const OmzigReveal = ({ children, delay = 0, y = 16, sx, ...rest }) => {
  const [ref, inView] = useInView()
  return (
    <Box
      ref={ref}
      sx={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translate3d(0,0,0)' : `translate3d(0, ${y}px, 0)`,
        transition: `opacity 620ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform 620ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
        willChange: 'opacity, transform',
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Box>
  )
}

OmzigReveal.propTypes = {
  children: PropTypes.node,
  delay: PropTypes.number,
  y: PropTypes.number,
  sx: PropTypes.object,
}
