import { useState, useEffect, useRef, useMemo } from 'react'
import Globe from './Globe'
import { PRODUCTS, BRANDS } from '../data'

const FONT = '"Alte Haas Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif'
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)
const pad2 = (n) => String(n).padStart(2, '0')
const D2R = Math.PI / 180

function vecLL(lng, lat) {
  const a = lng * D2R, b = lat * D2R
  return [Math.cos(b) * Math.sin(a), Math.sin(b), Math.cos(b) * Math.cos(a)]
}
function fibonacci(n) {
  const pts = [], phi = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(Math.max(0, 1 - y * y))
    pts.push([Math.cos(phi * i) * r, y, Math.sin(phi * i) * r])
  }
  return pts
}
function rotVec(v, cosY, sinY, cosT, sinT) {
  const x = v[0] * cosY + v[2] * sinY, z = -v[0] * sinY + v[2] * cosY
  const y2 = v[1] * cosT - z * sinT, z2 = v[1] * sinT + z * cosT
  return [x, y2, z2]
}

// Auto-spinning decorative globe for the intro hero — no interactivity, no spikes
function SpinGlobe() {
  const ref = useRef(null)
  const dots = useMemo(() => fibonacci(900), [])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let dpr, W, H, cx, cy, R0

    function applySize() {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      W = window.innerWidth; H = window.innerHeight
      canvas.width = W * dpr; canvas.height = H * dpr
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const mob = W < 768
      cx = mob ? W / 2 : W / 2 + 50
      cy = mob ? H * 0.46 : H / 2
      R0 = Math.min(W, H) / (mob ? 2.3 : 3.1)
    }
    applySize()

    let resizeRaf = 0
    const onResize = () => { cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(applySize) }
    window.addEventListener('resize', onResize)

    let yaw = 0
    const pitch = -0.28
    const cosT = Math.cos(pitch), sinT = Math.sin(pitch)
    let raf

    function frame() {
      yaw += 0.0018
      const cosY = Math.cos(yaw), sinY = Math.sin(yaw)
      ctx.clearRect(0, 0, W, H)

      ctx.beginPath(); ctx.arc(cx, cy, R0, 0, 2 * Math.PI)
      ctx.fillStyle = '#ebebeb'; ctx.fill()
      ctx.beginPath(); ctx.arc(cx, cy, R0, 0, 2 * Math.PI)
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.stroke()

      for (const d of dots) {
        const r = rotVec(d, cosY, sinY, cosT, sinT)
        if (r[2] <= 0) continue
        ctx.beginPath(); ctx.arc(cx + R0 * r[0], cy - R0 * r[1], 1.05, 0, 2 * Math.PI)
        ctx.fillStyle = `rgba(0,0,0,${0.08 + 0.34 * r[2]})`; ctx.fill()
      }

      const drawArc = (kind, fixed, col, lw) => {
        ctx.beginPath(); let s = false
        for (let t = kind === 'par' ? -180 : -88; t <= (kind === 'par' ? 180 : 88); t += 4) {
          const r = rotVec(kind === 'par' ? vecLL(t, fixed) : vecLL(fixed, t), cosY, sinY, cosT, sinT)
          if (r[2] <= 0.02) { s = false; continue }
          const sx = cx + R0 * r[0], sy = cy - R0 * r[1]
          if (!s) { ctx.moveTo(sx, sy); s = true } else ctx.lineTo(sx, sy)
        }
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke()
      }
      for (let lat = -60; lat <= 60; lat += 30)
        drawArc('par', lat, lat === 0 ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.12)', lat === 0 ? 1.3 : 1.2)
      for (let lng = -180; lng < 180; lng += 30)
        drawArc('mer', lng, 'rgba(0,0,0,0.12)', 1.2)

      raf = requestAnimationFrame(frame)
    }
    frame()

    return () => {
      cancelAnimationFrame(raf)
      cancelAnimationFrame(resizeRaf)
      window.removeEventListener('resize', onResize)
    }
  }, [dots])

  return <canvas ref={ref} style={{ display: 'block', pointerEvents: 'none' }} />
}


export default function GlobeIntro({ onOpenLookbook, onOpenWishlist, paused }) {
  const itemCount = PRODUCTS.length
  const brandCount = useMemo(() => new Set(PRODUCTS.map(p => p.brand)).size, [])

  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const [p, setP] = useState(0)
  const [entered, setEntered] = useState(false)
  const pRef = useRef(0)
  const enteredRef = useRef(false); enteredRef.current = entered
  const mobileRef = useRef(window.innerWidth < 768); mobileRef.current = vp.w < 768
  const touchY = useRef(0)

  const skip = () => { pRef.current = 1; setP(1); setEntered(true) }

  useEffect(() => {
    if (paused) return  // listeners removed entirely when product/lookbook open

    const advance = (delta) => {
      if (delta < 0 && pRef.current >= 1) return  // once fully entered, no going back
      pRef.current = clamp(pRef.current + delta, 0, 1)
      setP(pRef.current)
      if (pRef.current >= 1) setEntered(true)
      else if (enteredRef.current && delta < 0) setEntered(false)
    }
    const onWheel = (e) => {
      if (enteredRef.current && e.deltaY > 0) return
      advance(e.deltaY * 0.00055)
      e.preventDefault()
    }
    const onTouchStart = (e) => { touchY.current = e.touches[0].clientY }
    const onTouchMove = (e) => {
      const y = e.touches[0].clientY
      const dy = touchY.current - y; touchY.current = y
      if (enteredRef.current && dy > 0) return
      if (mobileRef.current && enteredRef.current) return
      advance(dy * 0.0014); e.preventDefault()
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
    }
  }, [paused])

  const mobile = vp.w < 768
  const M = mobile ? 16 : 56

  // Derived animation values
  const globeScale = mobile ? (0.74 + p * 0.26) : (0.58 + p * 0.42)
  const textFade = clamp(1 - p * 1.7, 0, 1)
  const spread = p * (mobile ? 60 : 230)
  const rawFade = clamp((1 - p) / 0.28, 0, 1)   // fade window: p 0.72→1.0 (was 0.88→1.0)
  const overlayOpacity = rawFade * rawFade * (3 - 2 * rawFade) // smoothstep
  const overlayGone = overlayOpacity < 0.02
  const globeUnpaused = p >= 0.68 || entered     // globe ready before fade starts

  return (
    <>
      <Globe
        onOpenLookbook={onOpenLookbook}
        onOpenWishlist={onOpenWishlist}
        paused={paused || !globeUnpaused}
      />

      {!overlayGone && (
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 100,
            background: '#fff',
            opacity: overlayOpacity,
            transition: 'opacity 180ms ease-out',
            pointerEvents: overlayGone ? 'none' : 'auto',
            overflow: 'hidden',
            fontFamily: FONT,
            color: '#0a0a0a',
          }}
        >
          {/* Auto-spinning hero globe (scaled) */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ transform: `scale(${globeScale})`, transformOrigin: 'center center', transition: 'transform 200ms cubic-bezier(0.23,1,0.32,1)' }}>
              <SpinGlobe />
            </div>
          </div>

          {/* Top bar — logo centered */}
          <div style={{
            position: 'absolute', top: M + 16, left: 0, right: 0,
            display: 'flex', justifyContent: 'center', alignItems: 'baseline',
          }}>
            <span style={{ fontWeight: 700, fontSize: mobile ? 48 : 42, letterSpacing: mobile ? -2 : -2, textTransform: 'uppercase' }}>
              PRET-A-CL<sup style={{ fontSize: mobile ? 20 : 18 }}>©</sup>
            </span>
          </div>

          {/* Main title — text separates as progress increases */}
          <div style={{
            position: 'absolute', top: mobile ? '46%' : '50%', left: 0, right: 0,
            transform: 'translateY(-50%)',
            textAlign: 'center',
            mixBlendMode: 'difference',
            pointerEvents: 'none',
          }}>
            {mobile ? (
              <h1 style={{
                margin: 0,
                fontSize: 'clamp(48px, 15vw, 64px)',
                lineHeight: 0.86,
                letterSpacing: -2.4,
                textTransform: 'uppercase',
                fontWeight: 700,
                color: '#fff',
              }}>
                <span style={{ display: 'block', transform: `translateX(-${spread}px)`, transition: 'transform 150ms cubic-bezier(0.23,1,0.32,1)' }}>No es</span>
                <span style={{ display: 'block', transform: `translateX(-${spread * 0.5}px)`, transition: 'transform 150ms cubic-bezier(0.23,1,0.32,1)' }}>retail.</span>
                <span style={{ display: 'block', transform: `translateX(${spread}px)`, transition: 'transform 150ms cubic-bezier(0.23,1,0.32,1)' }}>Es culto.</span>
              </h1>
            ) : (
              <h1 style={{
                margin: 0,
                fontSize: 'clamp(72px, 8.5vw, 150px)',
                lineHeight: 0.82,
                letterSpacing: -6,
                textTransform: 'uppercase',
                fontWeight: 700,
                color: '#fff',
              }}>
                <span style={{ display: 'block', transform: `translateX(-${spread}px)`, transition: 'transform 150ms cubic-bezier(0.23,1,0.32,1)' }}>No es retail.</span>
                <span style={{ display: 'block', transform: `translateX(${spread}px)`, transition: 'transform 150ms cubic-bezier(0.23,1,0.32,1)' }}>Es culto.</span>
              </h1>
            )}
          </div>

          {/* Inventory count — desktop bottom-left */}
          {!mobile && (
            <div style={{ position: 'absolute', left: M + 20, bottom: 150, opacity: textFade, transition: 'opacity 180ms ease-out' }}>
              <div style={{ fontSize: 11, letterSpacing: 2, color: '#555', textTransform: 'uppercase', fontWeight: 600 }}>
                Inventario vivo
              </div>
              <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: -1.5, textTransform: 'uppercase', marginTop: 4, lineHeight: 0.9, fontVariantNumeric: 'tabular-nums' }}>
                {pad2(itemCount)} piezas<br />{pad2(brandCount)} sellos
              </div>
            </div>
          )}
          {!mobile && (
            <div style={{ position: 'absolute', right: M + 20, bottom: 150, textAlign: 'right', opacity: textFade, transition: 'opacity 180ms ease-out', fontSize: 11, letterSpacing: 2, color: '#555', textTransform: 'uppercase', fontVariantNumeric: 'tabular-nums' }}>
              Santiago · 33°27′S 70°39′O<br />Globo Nº 01
            </div>
          )}


          {/* Scroll indicator + progress bar */}
          <div style={{
            position: 'absolute', bottom: M + 14, left: 0, right: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            opacity: clamp(1 - p * 1.4, 0, 1),
            pointerEvents: 'none',
          }}>
            <span style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 600 }}>
              Desplaza para entrar ↓
            </span>
            <div style={{ width: 200, height: 1.5, background: 'rgba(0,0,0,0.18)', position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${p * 100}%`, background: '#0a0a0a', transition: 'width 80ms ease-out' }} />
            </div>
          </div>

          {/* ENTRAR button — appears after first scroll nudge */}
          {p > 0.05 && (
            <button
              onClick={skip}
              style={{
                all: 'unset', cursor: 'pointer',
                position: 'absolute', bottom: M + 14, right: M + 20,
                fontSize: 11, letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase',
                color: '#0a0a0a', fontFamily: FONT,
                padding: '8px 16px',
                border: '1px solid rgba(0,0,0,0.4)',
                background: '#fff',
                opacity: clamp(p * 3, 0, 1),
                transition: 'opacity 200ms ease-out',
              }}
            >
              ENTRAR →
            </button>
          )}
        </div>
      )}
    </>
  )
}
