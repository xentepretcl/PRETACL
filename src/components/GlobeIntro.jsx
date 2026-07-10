import { useState, useEffect, useRef, useMemo } from 'react'
import Globe from './Globe'
import { PRODUCTS, BRANDS } from '../data'

const FONT = '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif'
const BRAND_FONT = '"Alte Haas Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif'
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)
const pad2 = (n) => String(n).padStart(2, '0')
const D2R = Math.PI / 180

function vecLL(lng, lat) {
  const a = lng * D2R, b = lat * D2R
  return [Math.cos(b) * Math.sin(a), Math.sin(b), Math.cos(b) * Math.cos(a)]
}
function rotVec(v, cosY, sinY, cosT, sinT) {
  const x = v[0] * cosY + v[2] * sinY, z = -v[0] * sinY + v[2] * cosY
  const y2 = v[1] * cosT - z * sinT, z2 = v[1] * sinT + z * cosT
  return [x, y2, z2]
}

// ASCII letter-field texture — the sphere is literally built from the brand name.
// Every cell of a monospace grid samples the front of the sphere; the letter it shows is
// fixed to that point on the globe (P-R-E-T---A---C-L wrapping around longitude), so as the
// globe turns you read PRET-A-CL scrolling across its face. `mix` (0..1) blends the disc from
// white/black-ink to a black gradient with white ink — the "black globe" seen at intro start.
const ASCII_SEQ = 'PRET-A-CL'
function drawAsciiField(ctx, cx, cy, R, cosY, sinY, cosT, sinT, mix) {
  const cell = Math.max(10, Math.min(16, R * 0.04))
  const half = cell / 2
  const NBANDS = 150
  const COL = 360 / NBANDS
  const LATOFF = 7
  const Lx = -0.42, Ly = 0.52, Lz = 0.74
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = Math.round(cell * 0.95) + 'px "SFMono-Regular", ui-monospace, "DejaVu Sans Mono", Menlo, Consolas, monospace'
  for (let py = cy - R + half; py <= cy + R; py += cell) {
    for (let px = cx - R + half; px <= cx + R; px += cell) {
      const X = (px - cx) / R, Y = -(py - cy) / R
      const r2 = X * X + Y * Y
      if (r2 > 1) continue
      const Z = Math.sqrt(1 - r2)
      const bright = Math.max(0, X * Lx + Y * Ly + Z * Lz)
      const rimFade = r2 < 0.86 ? 1 : Math.max(0, (1 - r2) / 0.14)
      const zPost = -Y * sinT + Z * cosT
      const vx = X * cosY - zPost * sinY
      const vy = Y * cosT + Z * sinT
      const vz = X * sinY + zPost * cosY
      const lon = Math.atan2(vx, vz) * 180 / Math.PI
      const lat = Math.asin(Math.max(-1, Math.min(1, vy))) * 180 / Math.PI
      const bandLon = Math.floor((lon + 180) / COL)
      const bandLat = Math.floor((lat + 90) / LATOFF)
      const ch = ASCII_SEQ[(((bandLon + bandLat) % ASCII_SEQ.length) + ASCII_SEQ.length) % ASCII_SEQ.length]
      const discDark = mix * Math.min(1, Math.max(0, (Math.sqrt(r2) - 0.12) / 0.72))
      let a, ink
      if (discDark > 0.5) { ink = '255,255,255'; a = (0.32 + 0.56 * bright) * rimFade }
      else { ink = '10,10,10'; a = (0.24 + 0.5 * (1 - bright)) * rimFade }
      if (a < 0.04) continue
      ctx.fillStyle = `rgba(${ink},${a.toFixed(3)})`
      ctx.fillText(ch, px, py)
    }
  }
}

// Auto-spinning decorative globe for the intro hero — no interactivity, no spikes.
// `discMix` (0..1, from scroll progress) morphs it from a black ASCII sphere into the
// plain white one underneath as the user scrolls in.
function SpinGlobe({ discMix }) {
  const ref = useRef(null)
  const discMixRef = useRef(discMix || 0); discMixRef.current = discMix || 0

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

    // monochrome grain tile, generated once, used to texture the black gradient
    const grain = document.createElement('canvas')
    grain.width = grain.height = 140
    const gctx = grain.getContext('2d')
    const gimg = gctx.createImageData(140, 140)
    for (let i = 0; i < gimg.data.length; i += 4) {
      const v = (Math.random() * 255) | 0
      gimg.data[i] = gimg.data[i + 1] = gimg.data[i + 2] = v
      gimg.data[i + 3] = 255
    }
    gctx.putImageData(gimg, 0, 0)
    const grainPat = ctx.createPattern(grain, 'repeat')

    function frame() {
      yaw += 0.0018
      const cosY = Math.cos(yaw), sinY = Math.sin(yaw)
      ctx.clearRect(0, 0, W, H)

      const mix = discMixRef.current
      ctx.beginPath(); ctx.arc(cx, cy, R0, 0, 2 * Math.PI)
      ctx.fillStyle = '#ffffff'; ctx.fill()
      if (mix > 0.01) {
        ctx.save()
        ctx.beginPath(); ctx.arc(cx, cy, R0, 0, 2 * Math.PI); ctx.clip()
        const grad = ctx.createRadialGradient(cx - R0 * 0.42, cy - R0 * 0.42, R0 * 0.05, cx, cy, R0 * 1.15)
        grad.addColorStop(0, '#ffffff')
        grad.addColorStop(0.55, '#d8d8d8')
        grad.addColorStop(0.82, '#5c5c5c')
        grad.addColorStop(1, '#0a0a0a')
        ctx.globalAlpha = mix
        ctx.fillStyle = grad
        ctx.fillRect(cx - R0, cy - R0, R0 * 2, R0 * 2)
        ctx.globalAlpha = 0.10 * mix
        ctx.globalCompositeOperation = 'overlay'
        if (grainPat) { ctx.fillStyle = grainPat; ctx.fillRect(cx - R0, cy - R0, R0 * 2, R0 * 2) }
        ctx.restore()
      }
      ctx.beginPath(); ctx.arc(cx, cy, R0, 0, 2 * Math.PI)
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.stroke()

      drawAsciiField(ctx, cx, cy, R0, cosY, sinY, cosT, sinT, mix)

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
  }, [])

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
  const discMix = clamp(1 - p * 1.05, 0, 1)      // black ASCII sphere → white as you scroll in

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
            <div style={{ transform: `scale(${globeScale})`, transformOrigin: 'center center' }}>
              <SpinGlobe discMix={discMix} />
            </div>
          </div>

          {/* Top bar — logo centered */}
          <div style={{
            position: 'absolute', top: M + 16, left: 0, right: 0,
            display: 'flex', justifyContent: 'center', alignItems: 'baseline',
          }}>
            <span style={{ fontFamily: BRAND_FONT, fontWeight: 700, fontSize: mobile ? 48 : 42, letterSpacing: mobile ? -2 : -2, textTransform: 'uppercase' }}>
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
                fontFamily: BRAND_FONT,
                fontSize: 'clamp(48px, 15vw, 64px)',
                lineHeight: 0.86,
                letterSpacing: -2.4,
                textTransform: 'uppercase',
                fontWeight: 700,
                color: '#fff',
              }}>
                <span style={{ display: 'block', transform: `translateX(-${spread}px)` }}>No es</span>
                <span style={{ display: 'block', transform: `translateX(-${spread * 0.5}px)` }}>retail.</span>
                <span style={{ display: 'block', transform: `translateX(${spread}px)` }}>Es culto.</span>
              </h1>
            ) : (
              <h1 style={{
                margin: 0,
                fontFamily: BRAND_FONT,
                fontSize: 'clamp(72px, 8.5vw, 150px)',
                lineHeight: 0.82,
                letterSpacing: -6,
                textTransform: 'uppercase',
                fontWeight: 700,
                color: '#fff',
              }}>
                <span style={{ display: 'block', transform: `translateX(-${spread}px)` }}>No es retail.</span>
                <span style={{ display: 'block', transform: `translateX(${spread}px)` }}>Es culto.</span>
              </h1>
            )}
          </div>

          {/* Inventory count — desktop bottom-left */}
          {!mobile && (
            <div style={{ position: 'absolute', left: M + 20, bottom: 150, opacity: textFade }}>
              <div style={{ fontSize: 11, letterSpacing: 2, color: '#555', textTransform: 'uppercase', fontWeight: 600 }}>
                Inventario vivo
              </div>
              <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: -1.5, textTransform: 'uppercase', marginTop: 4, lineHeight: 0.9, fontVariantNumeric: 'tabular-nums' }}>
                {pad2(itemCount)} piezas<br />{pad2(brandCount)} sellos
              </div>
            </div>
          )}
          {!mobile && (
            <div style={{ position: 'absolute', right: M + 20, bottom: 150, textAlign: 'right', opacity: textFade, fontSize: 11, letterSpacing: 2, color: '#555', textTransform: 'uppercase', fontVariantNumeric: 'tabular-nums' }}>
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
              <div style={{ position: 'absolute', inset: 0, background: '#0a0a0a', transform: `scaleX(${p})`, transformOrigin: 'left center' }} />
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
