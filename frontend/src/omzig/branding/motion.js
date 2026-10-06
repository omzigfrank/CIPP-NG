/**
 * omzig.ai motion primitives — the shared foundation for the signature
 * interaction layer. Everything here degrades to instant/static under
 * prefers-reduced-motion so the flourish is never a barrier.
 */
import { useEffect, useRef, useState } from 'react'

/** True when the viewer asked for reduced motion (SSR-safe). */
export const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(mq.matches)
    apply()
    mq.addEventListener?.('change', apply)
    return () => mq.removeEventListener?.('change', apply)
  }, [])
  return reduced
}

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

/**
 * Animate a number from 0 → value once, when `active`. Returns the current
 * value. Under reduced motion (or when inactive) it snaps to the target so
 * the DOM always ends on the real figure — important for tests and a11y.
 */
export const useCountUp = (value, { duration = 1000, active = true } = {}) => {
  const reduced = usePrefersReducedMotion()
  const target = Number.isFinite(Number(value)) ? Number(value) : 0
  const [display, setDisplay] = useState(reduced || !active ? target : 0)
  const rafRef = useRef(null)
  const startRef = useRef(null)

  useEffect(() => {
    if (reduced || !active) {
      setDisplay(target)
      return
    }
    // performance.now avoids Date.now (deterministic, resume-safe).
    startRef.current = null
    const step = (now) => {
      if (startRef.current === null) startRef.current = now
      const t = Math.min(1, (now - startRef.current) / duration)
      setDisplay(target * easeOutCubic(t))
      if (t < 1) rafRef.current = requestAnimationFrame(step)
      else setDisplay(target)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration, active, reduced])

  return display
}

/**
 * Reveal-on-scroll: attaches to a ref and flips `inView` true when the
 * element enters the viewport (once). Falls back to immediately-visible when
 * IntersectionObserver is unavailable, under reduced motion, and via a safety
 * timeout so content can never get stuck hidden.
 */
export const useInView = ({ threshold = 0.15, rootMargin = '0px 0px -8% 0px', fallbackMs = 700 } = {}) => {
  const reduced = usePrefersReducedMotion()
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (reduced || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const el = ref.current
    if (!el) return
    let done = false
    const finish = () => {
      if (done) return
      done = true
      setInView(true)
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && finish()),
      { threshold, rootMargin }
    )
    io.observe(el)
    // Safety net: never leave content invisible if the observer never fires.
    const timer = setTimeout(finish, fallbackMs)
    return () => {
      io.disconnect()
      clearTimeout(timer)
    }
  }, [reduced, threshold, rootMargin, fallbackMs])

  return [ref, inView]
}
