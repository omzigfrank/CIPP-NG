/**
 * omzig.ai animated number — counts up to `value` once, formatting each frame
 * with `format`. Snaps to the final value under reduced motion, so the DOM
 * always settles on the true figure.
 */
import PropTypes from 'prop-types'
import { useCountUp } from './motion'

export const AnimatedNumber = ({ value, format = (n) => n, duration = 1000, active = true }) => {
  const n = useCountUp(value, { duration, active })
  return <>{format(n)}</>
}

AnimatedNumber.propTypes = {
  value: PropTypes.number,
  format: PropTypes.func,
  duration: PropTypes.number,
  active: PropTypes.bool,
}
