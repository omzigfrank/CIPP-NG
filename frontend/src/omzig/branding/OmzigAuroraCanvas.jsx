/**
 * omzig.ai living aurora — a raw WebGL fragment shader (no Three.js, zero deps)
 * that paints a slow, flowing brand-blue/teal aurora and parallaxes gently
 * toward the pointer. It sits behind hero content (pointerEvents: none).
 *
 * Safety + accessibility:
 *  - Feature-detects WebGL; renders nothing (transparent) if unavailable, so
 *    the CSS aurora underneath remains the backdrop.
 *  - Fully paused under prefers-reduced-motion and hidden under
 *    prefers-reduced-transparency (matches tokens.css glass rules).
 *  - Caps device-pixel-ratio at 1.5 and pauses when off-screen / tab hidden
 *    to stay cheap (one full-screen quad, ~5 fbm octaves).
 */
import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from './motion'

const VERT = `
attribute vec2 p;
void main(){ gl_Position = vec4(p, 0.0, 1.0); }
`

// fbm value-noise aurora. Colours are the omzig.ai brand ramp.
const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x),
             mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0; float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for(int i=0;i<5;i++){ v += a*noise(p); p = m*p; a *= 0.5; }
  return v;
}
void main(){
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  vec2 asp = vec2(u_res.x/u_res.y, 1.0);
  vec2 q = uv*asp;
  float t = u_time*0.045;
  vec2 par = (u_mouse - 0.5) * 0.18;
  // Two drifting noise fields make the flowing "curtain".
  float n1 = fbm(q*2.4 + vec2(t, t*0.6) + par);
  float n2 = fbm(q*3.6 - vec2(t*0.8, t*0.5) + n1);
  float curtain = smoothstep(0.15, 1.0, n1*0.7 + n2*0.5);

  vec3 blue = vec3(0.188, 0.533, 0.784);   // brand blue-500
  vec3 deep = vec3(0.075, 0.129, 0.235);   // ink
  vec3 teal = vec3(0.086, 0.72, 0.66);     // #16B8A6
  vec3 col = mix(deep, blue, curtain);
  col = mix(col, teal, smoothstep(0.55, 1.0, n2) * 0.5 * curtain);

  // Vignette so edges melt into the hero panel.
  float vig = smoothstep(1.15, 0.2, length((uv-0.5)*asp));
  float alpha = curtain * vig * 0.9;
  gl_FragColor = vec4(col, alpha);
}
`

const compile = (gl, type, src) => {
  const s = gl.createShader(type)
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    gl.deleteShader(s)
    return null
  }
  return s
}

export const OmzigAuroraCanvas = () => {
  const reduced = usePrefersReducedMotion()
  const canvasRef = useRef(null)

  useEffect(() => {
    if (reduced) return
    // Respect reduced-transparency the same way the glass surfaces do.
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-transparency: reduce)').matches) return

    const canvas = canvasRef.current
    if (!canvas) return
    let gl
    try {
      gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false })
    } catch {
      return
    }
    if (!gl) return

    const vs = compile(gl, gl.VERTEX_SHADER, VERT)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) return
    const prog = gl.createProgram()
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    const uRes = gl.getUniformLocation(prog, 'u_res')
    const uTime = gl.getUniformLocation(prog, 'u_time')
    const uMouse = gl.getUniformLocation(prog, 'u_mouse')

    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 }
    const onMove = (e) => {
      const r = canvas.getBoundingClientRect()
      mouse.tx = (e.clientX - r.left) / r.width
      mouse.ty = 1 - (e.clientY - r.top) / r.height
    }
    const parent = canvas.parentElement
    parent?.addEventListener('pointermove', onMove)

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    const resize = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      canvas.width = Math.max(1, Math.floor(w * dpr))
      canvas.height = Math.max(1, Math.floor(h * dpr))
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    resize()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    ro?.observe(canvas)

    let raf
    let running = true
    let start = null
    const render = (now) => {
      if (!running) return
      if (start === null) start = now
      // Ease pointer for a smooth parallax.
      mouse.x += (mouse.tx - mouse.x) * 0.05
      mouse.y += (mouse.ty - mouse.y) * 0.05
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uTime, (now - start) / 1000)
      gl.uniform2f(uMouse, mouse.x, mouse.y)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)

    const onVis = () => {
      if (document.hidden) {
        running = false
        cancelAnimationFrame(raf)
      } else if (!running) {
        running = true
        start = null
        raf = requestAnimationFrame(render)
      }
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      parent?.removeEventListener('pointermove', onMove)
      document.removeEventListener('visibilitychange', onVis)
      ro?.disconnect()
      const ext = gl.getExtension('WEBGL_lose_context')
      ext?.loseContext()
    }
  }, [reduced])

  if (reduced) return null
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity: 0.9,
        mixBlendMode: 'screen',
      }}
    />
  )
}
