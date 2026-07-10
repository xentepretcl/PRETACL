import { useEffect, useRef, useState, useMemo, useCallback, lazy, Suspense } from 'react'
import { PRODUCTS, BRANDS } from '../data'
import { S } from '../tokens'
import { cdnResize } from '../imgUtil'
import { useTilt } from '../useTilt'
import { useWishlist } from '../WishlistContext'
import { useAuth } from '../AuthContext'

const Product = lazy(() => import('./Product'))

const PRODUCT_EXIT_MS = 280

const FONT = '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif'
const BRAND_FONT = '"Alte Haas Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif'

const CAT_META = {
  SUPERIOR:   { label: 'SUPERIOR',   sub: 'TOPS · POLERAS · CAMISAS',     lngC: -135 },
  INFERIOR:   { label: 'INFERIOR',   sub: 'FALDAS · PANTALONES · SHORTS', lngC: -45  },
  VESTIDOS:   { label: 'VESTIDOS',   sub: 'DRESSES · ENTEROS',            lngC: 45   },
  ACCESORIOS: { label: 'ACCESORIOS', sub: 'CAPS · BOLSOS · JOYAS',        lngC: 135  },
}
const CAT_ORDER = ['SUPERIOR', 'INFERIOR', 'VESTIDOS', 'ACCESORIOS']

function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return mobile
}

const COMBINING_MARK_LOW = 0x0300
const COMBINING_MARK_HIGH = 0x036f
function stripAccents(s) {
  return Array.from(s.normalize('NFD'))
    .filter((ch) => {
      const c = ch.codePointAt(0)
      return c < COMBINING_MARK_LOW || c > COMBINING_MARK_HIGH
    })
    .join('')
}

// `url` is included in the match text because some brand slugs (e.g. treino's
// "pantalon-baggy-barrel...") name the garment type only in the URL, not in
// the display name. The jacket/chaqueta guard stops "WORK JACKET ... JEANS"
// (denim as a material descriptor) from being misread as bottomwear.
function classify(name, url) {
  const n = stripAccents(`${name} ${url || ''}`.toLowerCase())
  if (/vestido|dress|entero|jumpsuit|\bmono\b|jumper pliss|maxi puffy|ola dress|sade dress/.test(n)) return 'VESTIDOS'
  if (!/jacket|chaqueta/.test(n) && /falda|pantalon|\bpants\b|skirt|jean|short|bermuda|pollera|legging|bikini|tanga/.test(n)) return 'INFERIOR'
  if (/gorro|gorra|\bcap\b|beani?e|zapato|shoe|bolso|\bbag\b|\bbelt\b|cinturon|bufanda|tote|case|bandana|joya|baguette|slipmat|loafer|headphone|cartera/.test(n)) return 'ACCESORIOS'
  return 'SUPERIOR'
}

function globePos(cat, idx) {
  const sectors = { SUPERIOR: [-180, -90], INFERIOR: [-90, 0], VESTIDOS: [0, 90], ACCESORIOS: [90, 180] }
  const [lo, hi] = sectors[cat]
  let s = Math.imul(idx + 1, 2654435761) >>> 0
  s = (Math.imul(s, 1664525) + 1013904223) >>> 0; const r1 = s / 4294967296
  s = (Math.imul(s, 1664525) + 1013904223) >>> 0; const r2 = s / 4294967296
  s = (Math.imul(s, 1664525) + 1013904223) >>> 0; const r3 = s / 4294967296
  return { lng: lo + r1 * (hi - lo), lat: (r2 - 0.5) * 80, h: 0.18 + r3 * 0.30 }
}

const ITEMS = PRODUCTS.map((p, idx) => {
  const c = classify(p.name, p.url)
  const pos = globePos(c, idx)
  const brand = BRANDS[p.brand]
  return { id: idx, t: brand?.name ?? p.brand.toUpperCase(), n: p.name, c, p: p.price, img: p.img, url: p.url, ...pos }
})

const D2R = Math.PI / 180
function vecLL(lng, lat) {
  const a = lng * D2R, b = lat * D2R
  return [Math.cos(b) * Math.sin(a), Math.sin(b), Math.cos(b) * Math.cos(a)]
}
// ASCII letter-field texture — the sphere is literally built from the brand name.
// Every cell of a monospace grid samples the front of the sphere; the letter it shows is
// fixed to that point on the globe (P-R-E-T---A---C-L wrapping around longitude), so as the
// globe turns you read PRET-A-CL scrolling across its face. Same effect as the intro globe.
const ASCII_SEQ = 'PRET-A-CL'
function drawAsciiField(ctx, cx, cy, R, cosY, sinY, cosT, sinT, mix, dim = 0) {
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
      if (dim > 0) a *= (1 - dim * 0.75)
      if (a < 0.04) continue
      ctx.fillStyle = `rgba(${ink},${a.toFixed(3)})`
      ctx.fillText(ch, px, py)
    }
  }
}

// ---- Decorative instrument grid: column hairlines, frame, rule lines ----
function GridFrame() { return null }

// ---- Globe canvas ----
function GlobeCanvas({ items, activeCats, hoverId, onHover, onPick, onFirstInteract, paused }) {
  const ref = useRef(null)
  const hoverImgRef = useRef(null)
  const lastHoverSrcRef = useRef(null)
  const stRef = useRef({ yaw: 0, pitch: -0.28, zoom: 1, anim: 0, activeCats: [], hoverId: null })
  stRef.current.hoverId = hoverId
  const onHoverRef = useRef(onHover); onHoverRef.current = onHover
  const onPickRef = useRef(onPick); onPickRef.current = onPick
  const onFirstInteractRef = useRef(onFirstInteract); onFirstInteractRef.current = onFirstInteract
  const tipsRef = useRef([])
  const pausedRef = useRef(paused)
  useEffect(() => { pausedRef.current = paused }, [paused])
  const catsKey = (activeCats || []).join(',')
  useEffect(() => { stRef.current.anim = 0; stRef.current.activeCats = activeCats || [] }, [catsKey])

  const spikes = useMemo(() => items.map(it => ({ it, v: vecLL(it.lng, it.lat) })), [items])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let dpr = Math.min(4, window.devicePixelRatio || 1)
    let W = window.innerWidth, H = window.innerHeight
    let cx = W / 2, cy = H / 2
    let R0 = Math.min(W, H) / 2.45

    function applySize() {
      dpr = Math.min(4, window.devicePixelRatio || 1)
      W = window.innerWidth; H = window.innerHeight
      canvas.width = W * dpr; canvas.height = H * dpr
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const mobile = W < 768
      cx = mobile ? W / 2 : W / 2 + 50; cy = mobile ? H * 0.46 : H / 2
      R0 = Math.min(W, H) / (mobile ? 2.3 : 3.1)
    }
    applySize()

    let resizeRaf = 0
    const onResize = () => {
      cancelAnimationFrame(resizeRaf)
      resizeRaf = requestAnimationFrame(applySize)
    }
    window.addEventListener('resize', onResize)

    let raf, cosT = 1, sinT = 0
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let lastInteract = performance.now() - 5000

    // Same black-sphere reveal as the intro globe: starts fully dark (gradient + grain)
    // and morphs to the plain disc the first time this canvas becomes visible/unpaused.
    let discMix = 1
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

    function rot(v, cosY, sinY) {
      const x = v[0] * cosY + v[2] * sinY, z = -v[0] * sinY + v[2] * cosY
      const y2 = v[1] * cosT - z * sinT, z2 = v[1] * sinT + z * cosT
      return [x, y2, z2]
    }

    let drag = null
    let pinch = null
    const pointers = new Map()
    let pressTimer = null
    function hitTest(cx_, cy_) {
      const rect = canvas.getBoundingClientRect()
      const mx = cx_ - rect.left, my = cy_ - rect.top
      let best = null, bestD = 26
      for (const tip of tipsRef.current) {
        const d = Math.hypot(tip.tx - mx, tip.ty - my)
        if (d < bestD) { bestD = d; best = tip }
      }
      return best
    }

    const onDown = e => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      try { canvas.setPointerCapture(e.pointerId) } catch (_) {}
      lastInteract = performance.now()
      onFirstInteractRef.current?.()

      // Second finger down — switch to pinch-to-zoom, cancel any single-finger drag/long-press.
      if (pointers.size === 2) {
        clearTimeout(pressTimer)
        drag = null
        onHoverRef.current(null)
        const [a, b] = [...pointers.values()]
        pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: stRef.current.zoom }
        return
      }
      if (pointers.size > 2) return

      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, longPress: false }
      onHoverRef.current(null)
      // Touch has no hover-before-press, so a long-press without movement opens the same
      // preview card the mouse gets for free on hover — lets touch users peek before committing.
      clearTimeout(pressTimer)
      pressTimer = setTimeout(() => {
        if (!drag || drag.moved) return
        const hit = hitTest(drag.sx, drag.sy)
        if (hit) { drag.longPress = true; onHoverRef.current({ id: hit.id }) }
      }, 450)
    }
    const onMove = e => {
      const st = stRef.current
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (pinch && pointers.size >= 2) {
        const [a, b] = [...pointers.values()]
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        st.zoom = Math.max(0.85, Math.min(1.6, pinch.zoom * (dist / pinch.dist)))
        lastInteract = performance.now()
        return
      }

      if (drag && drag.id === e.pointerId) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y
        if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 5) {
          drag.moved = true; canvas.style.cursor = 'grabbing'
          clearTimeout(pressTimer)
          if (drag.longPress) onHoverRef.current(null)
        }
        drag.x = e.clientX; drag.y = e.clientY
        st.yaw += dx * 0.006
        st.pitch = Math.max(-1.3, Math.min(1.3, st.pitch + dy * 0.006))
        lastInteract = performance.now()
        return
      }
      if (drag || pinch) return
      // Mouse-only: touch has no hover state, so a stray touchmove (e.g. from a
      // gesture starting over another element) must never fake a hover preview.
      if (e.pointerType === 'touch') return

      const hit = hitTest(e.clientX, e.clientY)
      canvas.style.cursor = hit ? 'pointer' : 'grab'
      onHoverRef.current(hit ? { id: hit.id } : null)
      if (hit) lastInteract = performance.now()
    }
    const onUp = e => {
      pointers.delete(e.pointerId)
      if (pinch) {
        if (pointers.size < 2) pinch = null
        lastInteract = performance.now()
        return
      }
      clearTimeout(pressTimer)
      if (drag && drag.id === e.pointerId) {
        if (!drag.moved && !drag.longPress) {
          const hit = hitTest(e.clientX, e.clientY)
          if (hit) onPickRef.current(hit.id, hit.cat)
        } else if (drag.longPress) {
          // Long-press just "peeks" — releasing dismisses the preview instead of leaving it stuck on screen.
          onHoverRef.current(null)
        }
        drag = null; canvas.style.cursor = 'grab'
      }
      lastInteract = performance.now()
    }
    const onWheel = e => {
      e.preventDefault()
      const st = stRef.current
      st.zoom = Math.max(0.85, Math.min(1.6, st.zoom - e.deltaY * 0.0012))
      lastInteract = performance.now()
    }
    canvas.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })

    const hoverAnims = new Map()

    function frame() {
      if (pausedRef.current) { raf = requestAnimationFrame(frame); return }
      const st = stRef.current
      if (st.anim < 1) st.anim = Math.min(1, st.anim + 0.045)
      const ease = 1 - Math.pow(1 - st.anim, 3)
      if (!reducedMotion && !drag && !st.hoverId && performance.now() - lastInteract > 900) {
        st.yaw += 0.0018
      }
      const cosY = Math.cos(st.yaw), sinY = Math.sin(st.yaw)
      cosT = Math.cos(st.pitch); sinT = Math.sin(st.pitch)
      const R = R0 * st.zoom

      ctx.clearRect(0, 0, W, H)

      if (discMix > 0) discMix = Math.max(0, discMix - 0.012)

      // Globe disc
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI)
      ctx.fillStyle = '#ebebeb'; ctx.fill()
      if (discMix > 0.01) {
        ctx.save()
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.clip()
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
        grad.addColorStop(0, '#e6e6e6')
        grad.addColorStop(0.35, '#a8a8a8')
        grad.addColorStop(0.65, '#4a4a4a')
        grad.addColorStop(1, '#050505')
        ctx.globalAlpha = discMix
        ctx.fillStyle = grad
        ctx.fillRect(cx - R, cy - R, R * 2, R * 2)
        ctx.globalAlpha = 0.10 * discMix
        ctx.globalCompositeOperation = 'overlay'
        if (grainPat) { ctx.fillStyle = grainPat; ctx.fillRect(cx - R, cy - R, R * 2, R * 2) }
        ctx.restore()
      }

      // ASCII letter field — sphere texture built from the brand name
      drawAsciiField(ctx, cx, cy, R, cosY, sinY, cosT, sinT, discMix, 1)

      // Coordinate graticule — parallels + meridians every 30°, instrument-plate texture
      const drawArc = (kind, fixed, col, lw) => {
        ctx.beginPath(); let started = false
        const lo = kind === 'par' ? -180 : -88, hi = kind === 'par' ? 180 : 88
        for (let t = lo; t <= hi; t += 4) {
          const v = kind === 'par' ? vecLL(t, fixed) : vecLL(fixed, t)
          const r = rot(v, cosY, sinY)
          if (r[2] <= 0.02) { started = false; continue }
          const sx = cx + R * r[0], sy = cy - R * r[1]
          if (!started) { ctx.moveTo(sx, sy); started = true } else ctx.lineTo(sx, sy)
        }
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke()
      }
      for (let lat = -60; lat <= 60; lat += 30) drawArc('par', lat, lat === 0 ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.12)', lat === 0 ? 1.3 : 1.2)
      for (let lng = -180; lng < 180; lng += 30) drawArc('mer', lng, 'rgba(0,0,0,0.12)', 1.2)

      // Sector meridians
      for (const lng of [-90, 0, 90, 180]) {
        ctx.beginPath(); let started = false
        for (let lat = -88; lat <= 88; lat += 4) {
          const r = rot(vecLL(lng, lat), cosY, sinY)
          if (r[2] <= 0.02) { started = false; continue }
          const sx = cx + R * r[0], sy = cy - R * r[1]
          if (!started) { ctx.moveTo(sx, sy); started = true } else ctx.lineTo(sx, sy)
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1.2; ctx.stroke()
      }

      // Product spikes
      const anyFilter = st.activeCats.length > 0
      const tips = []
      let hoverTip = null
      for (const sp of spikes) {
        const isActive = !anyFilter || st.activeCats.includes(sp.it.c)
        if (anyFilter && !isActive) continue
        const r = rot(sp.v, cosY, sinY)
        if (r[2] <= 0) continue
        const isHover = st.hoverId === sp.it.id
        const hPrev = hoverAnims.get(sp.it.id) ?? 0
        const hNext = hPrev + ((isHover ? 1 : 0) - hPrev) * 0.13
        hoverAnims.set(sp.it.id, hNext)
        const grow = anyFilter ? ease : 1
        const baseScale = anyFilter ? 0.65 : 0.2
        const hoverScale = anyFilter ? 1.3 : 0.8
        const H = sp.it.h * grow * (baseScale + (hoverScale - baseScale) * hNext)
        const bx = cx + R * r[0], by = cy - R * r[1]
        const tx = cx + R * r[0] * (1 + H), ty = cy - R * r[1] * (1 + H)
        tips.push({ id: sp.it.id, cat: sp.it.c, tx: bx, ty: by })
        const depth = 0.35 + 0.65 * r[2]
        let col, lw, tipR
        if (hNext > 0.5) { col = `rgba(0,0,0,${0.6 + 0.4 * hNext})`; lw = 1.2 + 1.2 * hNext; tipR = 1.8 + 2.2 * hNext }
        else if (anyFilter) { col = `rgba(0,0,0,${0.55 * depth + 0.3})`; lw = 1.2; tipR = 1.8 }
        else { col = `rgba(0,0,0,${0.4 * depth})`; lw = 1; tipR = 1.4 }
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty)
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke()
        ctx.beginPath(); ctx.arc(tx, ty, tipR, 0, 2 * Math.PI)
        ctx.fillStyle = col; ctx.fill()
        if (hNext > 0.05) {
          const ringR = 4 + 6 * hNext
          ctx.beginPath(); ctx.arc(tx, ty, ringR, 0, 2 * Math.PI)
          ctx.strokeStyle = `rgba(0,0,0,${0.6 * hNext})`; ctx.lineWidth = 1.2; ctx.stroke()
          if (isHover) hoverTip = { tx, ty, diam: ringR * 2, opacity: hNext, img: sp.it.img }
        }
      }

      // Mini product photo pinned over the hovered spike — same footprint as its hover ring
      if (hoverImgRef.current) {
        const el = hoverImgRef.current
        if (hoverTip && hoverTip.img) {
          if (lastHoverSrcRef.current !== hoverTip.img) {
            el.src = cdnResize(hoverTip.img, 160)
            lastHoverSrcRef.current = hoverTip.img
          }
          el.style.width = hoverTip.diam + 'px'
          el.style.height = hoverTip.diam + 'px'
          el.style.left = (hoverTip.tx - hoverTip.diam / 2) + 'px'
          el.style.top = (hoverTip.ty - hoverTip.diam / 2) + 'px'
          el.style.opacity = String(hoverTip.opacity)
        } else {
          el.style.opacity = '0'
        }
      }

      // Category labels when no filter — visible across most of the rotation, not just face-on,
      // so the sector→region mapping stays legible while dragging (not just at rest).
      if (!anyFilter) {
        ctx.textAlign = 'center'
        for (const k of CAT_ORDER) {
          const m = CAT_META[k]
          const r = rot(vecLL(m.lngC, 0), cosY, sinY)
          if (r[2] <= -0.45) continue
          const sx = cx + R * r[0] * 1.02, sy = cy - R * r[1] * 1.02
          const fade = Math.max(0, Math.min(1, (r[2] + 0.45) / 0.7))
          ctx.font = `700 13px ${FONT}`
          ctx.fillStyle = `rgba(0,0,0,${0.22 + 0.68 * fade})`
          ctx.fillText(m.label, sx, sy)
        }
      }

      tipsRef.current = tips
      raf = requestAnimationFrame(frame)
    }
    frame()
    return () => {
      cancelAnimationFrame(raf)
      cancelAnimationFrame(resizeRaf)
      clearTimeout(pressTimer)
      window.removeEventListener('resize', onResize)
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [spikes])

  return (
    <>
      <canvas ref={ref} style={{ display: 'block', cursor: 'grab', touchAction: 'none', animation: 'pac-scale-in 300ms cubic-bezier(.22,.61,.36,1)' }} />
      <img
        ref={hoverImgRef}
        alt=""
        draggable="false"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          borderRadius: 0,
          objectFit: 'cover',
          background: '#fff',
          boxShadow: '0 0 0 1.5px rgba(255,255,255,0.9), 0 2px 8px rgba(0,0,0,0.35)',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: 2,
          transition: 'opacity 100ms ease-out',
        }}
      />
    </>
  )
}

function CatTile({ it, isSel, delay, liked, style }) {
  const { ref, onPointerMove, onPointerLeave } = useTilt(6)
  return (
    <div data-lid={it.id} className="pac-tile" style={{ ...style, animation: `pac-scale-in 420ms cubic-bezier(.22,.61,.36,1) ${delay}ms backwards` }}>
      <div ref={ref} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} className="pac-tile-card" style={{ position: 'relative', background: '#ececef', overflow: 'hidden', width: '100%', height: '100%', boxShadow: isSel ? '0 0 0 2px #000' : 'none', transition: 'box-shadow 150ms ease, transform 260ms cubic-bezier(.22,.61,.36,1)' }}>
        {it.img && <img src={cdnResize(it.img, 460)} alt={it.n} width={230} height={305} loading="lazy" decoding="async" draggable={false} onError={(e) => { e.currentTarget.style.display = 'none' }} className="pac-tile-img" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 320ms cubic-bezier(.22,.61,.36,1)' }} />}
        <div data-heart={it.id} role="button" aria-pressed={liked} aria-label={liked ? 'Quitar de wishlist' : 'Agregar a wishlist'} style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, background: liked ? '#0a0a0a' : 'rgba(255,255,255,0.88)', color: liked ? '#fff' : '#0a0a0a', cursor: 'pointer' }}>
          {liked ? '♥' : '♡'}
        </div>
        <div style={{ position: 'absolute', left: -1, right: -1, bottom: -1, padding: '10px 13px', background: 'rgba(255,255,255,0.92)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <span style={{ color: '#0a0a0a', fontWeight: 700, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.n}</span>
          <span style={{ color: '#0a0a0a', fontWeight: 500, fontSize: 10, whiteSpace: 'nowrap', marginLeft: 6 }}>{it.p}</span>
        </div>
      </div>
    </div>
  )
}

function CatBlock({ aria, blockW, blockH, cells, ordered, n, cols, colStep, rowStep, tileW, tileH, selId, liked }) {
  return (
    <div aria-hidden={aria || undefined} style={{ position: 'relative', width: blockW, height: blockH }}>
      {Array.from({ length: cells }).map((_, idx) => {
        const it = ordered[idx % n]
        const col = idx % cols, row = Math.floor(idx / cols)
        const isSel = !aria && it.id === selId && idx < n
        const delay = ((col + row) % 7) * 45
        return (
          <CatTile key={idx} it={it} isSel={isSel} delay={delay} liked={liked.has(it.id)}
            style={{ position: 'absolute', left: col * colStep, top: row * rowStep + (col % 2 ? rowStep / 2 : 0), width: tileW, height: tileH }} />
        )
      })}
    </div>
  )
}

// ---- Category Lookbook overlay ----
function CatLookbook({ cats, startId, items, onClose, closing }) {
  const mobile = useIsMobile()
  const list = useMemo(() => items.filter(i => cats.includes(i.c)), [items, cats])
  const [selId, setSelId] = useState(startId)
  const sel = list.find(i => i.id === selId) ?? list[0]
  const [product, setProduct] = useState(null)
  const [productClosing, setProductClosing] = useState(false)
  const { liked, toggle } = useWishlist()
  const { user, signInWithGoogle } = useAuth()
  const [loginHint, setLoginHint] = useState(false)
  const loginHintTimer = useRef(null)
  const requireAuth = (fn) => {
    if (user) { fn(); return }
    setLoginHint(true)
    clearTimeout(loginHintTimer.current)
    loginHintTimer.current = setTimeout(() => setLoginHint(false), 3500)
  }
  const closeProduct = useCallback(() => {
    setProductClosing(true)
    setTimeout(() => { setProduct(null); setProductClosing(false) }, PRODUCT_EXIT_MS)
  }, [])

  const ordered = useMemo(() => {
    const i = list.findIndex(x => x.id === selId)
    return i < 0 ? list : [...list.slice(i), ...list.slice(0, i)]
  }, [list, selId])

  const HEAD = mobile ? 54 : 74, FOOT = mobile ? 0 : 132
  const tileW = mobile ? 185 : 230, tileH = mobile ? 248 : 305, gap = mobile ? 8 : 26
  const vw = window.innerWidth, vh = window.innerHeight - HEAD - FOOT
  const colStep = tileW + gap, rowStep = tileH + gap
  const n = ordered.length
  const cols = Math.ceil((vw + colStep) / colStep) + 1
  const rows = Math.ceil((vh + rowStep) / rowStep) + 1
  const cells = cols * rows
  const blockW = cols * colStep, blockH = rows * rowStep

  const vpRef = useRef(null), wrapRef = useRef(null)
  const off = useRef({ x: vw / 2 - tileW / 2, y: vh / 2 - tileH / 2 })
  const vel = useRef({ x: 0, y: 0 })
  const drag = useRef(null), raf = useRef(0)

  const paint = () => {
    const x = ((off.current.x % blockW) + blockW) % blockW - blockW
    const y = ((off.current.y % blockH) + blockH) % blockH - blockH
    if (wrapRef.current) wrapRef.current.style.transform = `translate3d(${x}px,${y}px,0)`
  }

  useEffect(() => {
    off.current = { x: vw / 2 - tileW / 2, y: vh / 2 - tileH / 2 }
    vel.current = { x: 0, y: 0 }; paint()
  }, [selId])

  useEffect(() => {
    paint()
    const el = vpRef.current; if (!el) return
    const onDown = e => {
      drag.current = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: Date.now() }
      vel.current = { x: 0, y: 0 }; cancelAnimationFrame(raf.current)
      el.style.cursor = 'grabbing'
      try { el.setPointerCapture(e.pointerId) } catch (_) {}
    }
    const onMove = e => {
      if (!drag.current) return
      const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y
      drag.current.x = e.clientX; drag.current.y = e.clientY
      off.current.x += dx; off.current.y += dy
      vel.current = { x: dx, y: dy }; paint()
    }
    const onUp = e => {
      if (!drag.current) return
      const moved = Math.hypot(e.clientX - drag.current.sx, e.clientY - drag.current.sy)
      if (moved < 6 && Date.now() - drag.current.t < 400) {
        const hit = document.elementFromPoint(e.clientX, e.clientY)
        const heart = hit?.closest('[data-heart]')
        if (heart) {
          requireAuth(() => toggle(+heart.dataset.heart))
        } else {
          const tile = hit?.closest('[data-lid]')
          if (tile) {
            const id = +tile.dataset.lid
            setSelId(id)
            setProduct(PRODUCTS[id])
          }
        }
      }
      drag.current = null; el.style.cursor = 'grab'
      const decay = () => {
        vel.current.x *= 0.92; vel.current.y *= 0.92
        off.current.x += vel.current.x; off.current.y += vel.current.y; paint()
        if (Math.abs(vel.current.x) > 0.15 || Math.abs(vel.current.y) > 0.15) raf.current = requestAnimationFrame(decay)
      }
      raf.current = requestAnimationFrame(decay)
    }
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      cancelAnimationFrame(raf.current)
    }
  }, [blockW, blockH, ordered])

  if (list.length === 0) {
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: '#fff', color: '#0a0a0a', fontFamily: FONT, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 32px', animation: closing ? 'pac-scale-out 200ms ease-out forwards' : 'pac-scale-in 280ms cubic-bezier(.22,.61,.36,1)' }}>
        <button onClick={onClose} aria-label="Cerrar lookbook" className="pac-closebtn" style={{ all: 'unset', cursor: 'pointer', position: 'absolute', top: 16, right: 18, zIndex: 60, width: 40, height: 40, border: '1px solid rgba(0,0,0,0.3)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, fontFamily: FONT }}>✕</button>
        <div style={{ fontSize: 56, marginBottom: 8 }}>♡</div>
        <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5, textTransform: 'uppercase' }}>Tu wishlist está vacía</div>
        <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: 1, color: '#0a0a0a', textTransform: 'uppercase', marginTop: 14, maxWidth: 420, lineHeight: 1.6 }}>
          Abre un lookbook y toca el corazón ♥ en cualquier prenda para guardarla aquí.
        </div>
      </div>
    )
  }

  const selIdx = list.findIndex(i => i.id === sel?.id)
  const blockProps = { blockW, blockH, cells, ordered, n, cols, colStep, rowStep, tileW, tileH, selId: sel?.id, liked }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: '#fff', color: '#0a0a0a', fontFamily: FONT, display: 'flex', flexDirection: 'column', animation: closing ? 'pac-scale-out 200ms ease-out forwards' : 'pac-scale-in 280ms cubic-bezier(.22,.61,.36,1)' }}>
      <div ref={vpRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: 'grab', touchAction: 'none', userSelect: 'none', background: '#f4f4f2' }}>
        <div ref={wrapRef} style={{ position: 'absolute', top: 0, left: 0, display: 'grid', gridTemplateColumns: 'max-content max-content', willChange: 'transform' }}>
          <CatBlock {...blockProps} /><CatBlock {...blockProps} aria />
          <CatBlock {...blockProps} aria /><CatBlock {...blockProps} aria />
        </div>
        {mobile && [
          { left: 0, top: 0, bottom: 0, width: 56, mask: 'linear-gradient(90deg, black, transparent)' },
          { right: 0, top: 0, bottom: 0, width: 56, mask: 'linear-gradient(270deg, black, transparent)' },
          { left: 0, right: 0, top: 0, height: 56, mask: 'linear-gradient(180deg, black, transparent)' },
          { left: 0, right: 0, bottom: 0, height: 56, mask: 'linear-gradient(0deg, black, transparent)' },
        ].map((s, i) => (
          <div key={i} aria-hidden="true" style={{
            position: 'absolute', pointerEvents: 'none',
            left: s.left, right: s.right, top: s.top, bottom: s.bottom,
            width: s.width, height: s.height,
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            background: 'rgba(255,255,255,0.05)',
            maskImage: s.mask, WebkitMaskImage: s.mask,
          }} />
        ))}
      </div>

      {/* Brand mark — floats over gallery, no background. Same on mobile and desktop so the
          lookbook reads as one consistent surface, not two different UIs. Kept outside the
          draggable viewport so its pointer capture doesn't swallow clicks meant for it / the close button. */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', padding: '22px 0', pointerEvents: 'none' }}>
        <div style={{ fontFamily: BRAND_FONT, fontSize: 28, letterSpacing: 1, fontWeight: 700, color: '#fff', mixBlendMode: 'difference', animation: 'pac-fade-up 500ms cubic-bezier(.22,.61,.36,1)' }}>
          PRET-A-CL
        </div>
      </div>
      <button onClick={onClose} aria-label="Cerrar lookbook" className="pac-closebtn" style={{ all: 'unset', cursor: 'pointer', position: 'absolute', top: 16, right: 18, zIndex: 60, width: 40, height: 40, border: '1px solid rgba(0,0,0,0.3)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, fontFamily: FONT }}>✕</button>

      {sel && !mobile && (
        <div className="pac-lb-foot" style={{ height: 132, flexShrink: 0, borderTop: '1px solid rgba(0,0,0,0.14)', display: 'flex', alignItems: 'center', gap: S.md, padding: '0 24px', background: '#fff', overflow: 'hidden' }}>
          <div key={sel.id} className="pac-lb-foot-inner" style={{ display: 'flex', alignItems: 'center', gap: S.md, width: '100%', animation: 'pac-fade-up 220ms cubic-bezier(.22,.61,.36,1)' }}>
            <span className="pac-lb-foot-idx" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>Nº {String(selIdx + 1).padStart(2, '0')}</span>
            <div className="pac-lb-foot-thumb" style={{ width: 88, height: 100, flexShrink: 0, background: '#ececef', overflow: 'hidden' }}>
              {sel.img && <img src={cdnResize(sel.img, 180)} alt={sel.n} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div className="pac-lb-foot-info" style={{ flex: 1, minWidth: 0 }}>
              <div className="pac-lb-foot-brand" style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: '#0a0a0a', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sel.t} · {CAT_META[sel.c].label}</div>
              <div className="pac-lb-foot-name" style={{ fontSize: 16, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, lineHeight: 1.2, marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sel.n}</div>
              <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>{sel.p}</div>
            </div>
            <div className="pac-lb-foot-actions" style={{ display: 'flex', alignItems: 'center', gap: S.xs, flexShrink: 0 }}>
              {sel.url && (
                <a href={sel.url} target="_blank" rel="noopener noreferrer" className="pac-lb-foot-cta"
                  style={{ all: 'unset', cursor: 'pointer', padding: '13px 24px', background: '#0a0a0a', color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: FONT, whiteSpace: 'nowrap', flexShrink: 0, textAlign: 'center' }}>
                  {sel.p ? 'COMPRAR' : 'VER'} ↗ <span style={{ color: 'rgba(255,255,255,0.65)', marginLeft: 8 }}>{sel.t}</span>
                </a>
              )}
              <button onClick={() => requireAuth(() => toggle(sel.id))} aria-pressed={liked.has(sel.id)} aria-label={liked.has(sel.id) ? 'Quitar de wishlist' : 'Agregar a wishlist'}
                className="pac-lb-foot-heart"
                style={{ all: 'unset', cursor: 'pointer', width: 50, height: 50, flexShrink: 0, border: `1px solid ${liked.has(sel.id) ? '#0a0a0a' : 'rgba(0,0,0,0.3)'}`, background: liked.has(sel.id) ? '#0a0a0a' : 'transparent', color: liked.has(sel.id) ? '#fff' : '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontFamily: FONT }}>
                {liked.has(sel.id) ? '♥' : '♡'}
              </button>
            </div>
          </div>
        </div>
      )}

      {product && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 70,
          background: '#fff',
          animation: productClosing
            ? `pac-fade-down ${PRODUCT_EXIT_MS}ms cubic-bezier(.22,.61,.36,1) forwards`
            : 'pac-fade-up 320ms cubic-bezier(.22,.61,.36,1)',
        }}>
          <button onClick={closeProduct} aria-label="Cerrar producto" className="pac-closebtn" style={{ all: 'unset', cursor: 'pointer', position: 'absolute', top: 16, right: 18, zIndex: 80, width: 40, height: 40, border: '1px solid rgba(0,0,0,0.3)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, fontFamily: FONT }}>✕</button>
          <Suspense fallback={null}>
            <Product product={product} />
          </Suspense>
        </div>
      )}

      {/* Login hint toast */}
      {loginHint && (
        <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: '#0a0a0a', color: '#fff', display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', whiteSpace: 'nowrap', fontFamily: FONT, animation: 'pac-fade-up 200ms ease-out' }}>
          <span style={{ fontSize: 12, letterSpacing: 0.5 }}>Inicia sesión para guardar prendas</span>
          <button onClick={signInWithGoogle} style={{ all: 'unset', cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', textDecoration: 'underline', textUnderlineOffset: 3 }}>INGRESAR →</button>
        </div>
      )}
    </div>
  )
}

// ---- Mobile corner crop mark (decorative, frames the globe field) ----
function CropMark({ top, bottom, left, right }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"
      style={{ position: 'absolute', top, bottom, left, right, zIndex: 5, pointerEvents: 'none' }}>
      <g stroke="rgba(0,0,0,0.55)" strokeWidth="1.5">
        <line x1="0" y1="9" x2="18" y2="9" />
        <line x1="9" y1="0" x2="9" y2="18" />
      </g>
    </svg>
  )
}

// ---- Globe home page ----
export default function Globe({ onOpenLookbook, onOpenWishlist, paused }) {
  const mobile = useIsMobile()
  const { liked } = useWishlist()
  const { user, signInWithGoogle } = useAuth()
  const signInRequested = useRef(false)
  const [cats, setCats] = useState([])
  const [hoverId, setHoverId] = useState(null)
  const [gHover, setGHover] = useState(null)
  const [open, setOpen] = useState(null)
  const [openClosing, setOpenClosing] = useState(false)
  const closeOpen = useCallback(() => {
    setOpenClosing(true)
    setTimeout(() => { setOpen(null); setOpenClosing(false) }, 240)
  }, [])
  // Mobile: tapping a spike just rotates past it otherwise — show a quick liquid-glass
  // card with what it is instead of committing straight into the full category lookbook.
  const [spikePreview, setSpikePreview] = useState(null)
  const [spikeProduct, setSpikeProduct] = useState(null)
  const canvasPaused = paused || !!open || !!spikePreview || !!spikeProduct

  const active = cats.length > 0
  const counts = useMemo(() => {
    const c = {}; ITEMS.forEach(i => { c[i.c] = (c[i.c] || 0) + 1 }); return c
  }, [])
  const listItems = useMemo(() => active ? ITEMS.filter(i => cats.includes(i.c)) : [], [cats, active])
  const brandCount = useMemo(() => new Set(ITEMS.map(i => i.t)).size, [])

  const activeRef = useRef(false); activeRef.current = active
  const gHoverItem = gHover ? ITEMS.find(i => i.id === gHover.id) : null

  const onGlobeHover = useCallback(h => {
    if (!h) { setGHover(null); setHoverId(null); return }
    setHoverId(h.id)
    if (activeRef.current) setGHover({ id: h.id })
    else setGHover(null)
  }, [])
  const onGlobePick = useCallback((id, cat) => {
    setGHover(null); setHoverId(null)
    if (mobile) {
      setSpikePreview(ITEMS.find(i => i.id === id))
    } else {
      setOpen({ cats: [cat], startId: id })
    }
  }, [mobile])
  const toggleCat = useCallback(k => setCats(cur => cur.includes(k) ? cur.filter(x => x !== k) : [...cur, k]), [])

  const [hintVisible, setHintVisible] = useState(() => {
    try { return !localStorage.getItem('pac-globe-hint-seen') } catch (_) { return true }
  })
  const dismissHint = useCallback(() => {
    setHintVisible(false)
    try { localStorage.setItem('pac-globe-hint-seen', '1') } catch (_) {}
  }, [])


  useEffect(() => {
    if (user && signInRequested.current) {
      signInRequested.current = false
      onOpenWishlist()
    }
  }, [user, onOpenWishlist])

  const handleAccountClick = useCallback(() => {
    if (user) {
      onOpenWishlist()
    } else {
      signInRequested.current = true
      signInWithGoogle()
    }
  }, [user, onOpenWishlist, signInWithGoogle])

  return (
    <div className="pac-viewport" style={{ position: 'relative', background: '#fff', color: '#0a0a0a', fontFamily: FONT, overflow: 'hidden' }}>
      {/* Decorative instrument grid — column hairlines, frame, crop marks */}
      <GridFrame />

      {/* Full-screen globe canvas — positioned above the decorative grid so the sphere occludes it */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <GlobeCanvas items={ITEMS} activeCats={cats} hoverId={hoverId} onHover={onGlobeHover} onPick={onGlobePick} onFirstInteract={dismissHint} paused={canvasPaused} />
      </div>

      {mobile ? (
        <>
          {/* Floating top chrome — brand + counts (left), account/wishlist (right) */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, pointerEvents: 'none', padding: '14px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', animation: 'pac-fade-up 500ms cubic-bezier(.22,.61,.36,1)' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 26, letterSpacing: -0.5, lineHeight: 1, fontFamily: BRAND_FONT }}>PRET-A-CL<sup style={{ fontSize: 12 }}>©</sup></div>
              <div style={{ fontSize: 9, letterSpacing: 1.5, color: '#0a0a0a', textTransform: 'uppercase', fontWeight: 600, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                {String(ITEMS.length).padStart(2, '0')} PIEZAS · {String(brandCount).padStart(2, '0')} SELLOS
              </div>
            </div>
            <button onClick={handleAccountClick}
              style={{ all: 'unset', pointerEvents: 'auto', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', border: '1px solid #0a0a0a', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', fontFamily: FONT, color: user && liked.size ? '#fff' : '#0a0a0a', background: user && liked.size ? '#0a0a0a' : '#fff' }}>
              {user ? `${liked.size ? '♥' : '♡'} WISHLIST (${String(liked.size).padStart(2, '0')})` : 'CUENTA'}
            </button>
          </div>

          {/* Corner crop marks — frame the globe field, above chrome / below dock */}
          <CropMark top={78} left={16} />
          <CropMark top={78} right={16} />
          <CropMark bottom={168} left={16} />
          <CropMark bottom={168} right={16} />

          {/* One-time drag affordance hint */}
          {hintVisible && !canvasPaused && (
            <div aria-hidden="true" style={{
              position: 'absolute', top: '46%', left: '50%', transform: 'translate(-50%,-50%)',
              zIndex: 5, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              animation: 'pac-fade-in 700ms ease-out 900ms backwards',
            }}>
              <svg width="64" height="28" viewBox="0 0 64 28" style={{ animation: 'pac-hint-swipe 1.6s ease-in-out infinite' }}>
                <path d="M6 14 H50 M50 14 L40 6 M50 14 L40 22" stroke="rgba(10,10,10,0.55)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}

          {/* Floating bottom dock — hint/CTA row + horizontal-scroll category chips */}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 10, padding: '0 12px 14px', paddingBottom: 'calc(14px + env(safe-area-inset-bottom))' }}>
            {active ? (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <button
                  onClick={() => listItems.length > 0 && setOpen({ cats: [...cats], startId: listItems[0].id })}
                  style={{ all: 'unset', cursor: 'pointer', flex: 1, textAlign: 'center', padding: '15px', background: '#0a0a0a', color: '#fff', fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', fontFamily: FONT }}>
                  ABRIR LOOKBOOK · {String(listItems.length).padStart(2, '0')} →
                </button>
                <button
                  onClick={() => setCats([])}
                  style={{ all: 'unset', cursor: 'pointer', padding: '15px 16px', border: '1px solid #0a0a0a', background: '#fff', color: '#0a0a0a', fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', fontFamily: FONT }}>✕</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                <div style={{ textAlign: 'center', fontSize: 9, letterSpacing: 1.5, color: '#0a0a0a', textTransform: 'uppercase' }}>
                  Arrastra para rotar · elige una región
                </div>
                <button
                  onClick={onOpenLookbook}
                  style={{ all: 'unset', cursor: 'pointer', textAlign: 'center', padding: '13px', border: '1px solid #0a0a0a', background: '#fff', color: '#0a0a0a', fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', fontFamily: FONT }}>
                  VER TODO EL LOOKBOOK · {String(ITEMS.length).padStart(2, '0')} →
                </button>
              </div>
            )}
            <div className="pac-chiprow" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
              {CAT_ORDER.map((k, i) => {
                const m = CAT_META[k]
                const on = cats.includes(k)
                return (
                  <button key={k} onClick={() => toggleCat(k)}
                    style={{ all: 'unset', cursor: 'pointer', flex: 'none', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: '1px solid #0a0a0a', background: on ? '#0a0a0a' : '#fff', color: on ? '#fff' : '#0a0a0a', whiteSpace: 'nowrap', fontFamily: FONT }}>
                    <span style={{ fontSize: 9, fontWeight: 700, fontVariantNumeric: 'tabular-nums', opacity: 0.7 }}>{String(i + 1).padStart(2, '0')}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase' }}>{m.label}</span>
                    <span style={{ fontSize: 9, fontWeight: 500, fontVariantNumeric: 'tabular-nums', opacity: 0.7 }}>{String(counts[k] || 0).padStart(2, '0')}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* One-time drag affordance hint — dismissed permanently on first pointerdown on the globe */}
          {hintVisible && !canvasPaused && (
            <div aria-hidden="true" className="pac-drag-hint" style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              zIndex: 5, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              animation: 'pac-fade-in 700ms ease-out 900ms backwards',
            }}>
              <svg width="64" height="28" viewBox="0 0 64 28" style={{ animation: 'pac-hint-swipe 1.6s ease-in-out infinite' }}>
                <path d="M6 14 H50 M50 14 L40 6 M50 14 L40 22" stroke="rgba(10,10,10,0.55)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: '#0a0a0a', textTransform: 'uppercase', fontWeight: 700 }}>
                ARRASTRA PARA EXPLORAR
              </div>
            </div>
          )}

          {/* Header band — brand mark + tagline (left), coordinates + globe index + date (right) */}
          <div className="pac-headerband" style={{ position: 'absolute', top: 32, left: 0, right: 0, height: 64, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', animation: 'pac-fade-up 500ms cubic-bezier(.22,.61,.36,1)' }}>
            <span className="pac-headerband-brand" style={{ fontFamily: BRAND_FONT, fontWeight: 700, fontSize: 44, lineHeight: 0.9, letterSpacing: 0.5, transform: 'translateX(50px)' }}>
              PRET-A-CL<sup style={{ fontSize: 18 }}>©</sup>
            </span>
            <button onClick={handleAccountClick} className="pac-cta"
              style={{ all: 'unset', position: 'absolute', right: 56, pointerEvents: 'auto', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 13px', fontWeight: 700, fontFamily: FONT, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#fff', background: '#0a0a0a' }}>
              CUENTA
            </button>
          </div>

          {/* Left editorial column: masthead + headline + intro (top) / numbered region index (bottom) */}
          <div className="pac-editorial">
            <div style={{ animation: 'pac-fade-up 600ms cubic-bezier(.22,.61,.36,1)' }}>
              <div className="pac-hero-display" style={{ textTransform: 'uppercase', marginTop: 16, fontWeight: 700 }}>
                NO ES<br />RETAIL.<br />ES CULTO.
              </div>
              <div style={{ marginTop: 14, maxWidth: 420 }}>
                <div style={{ fontSize: 13.5, lineHeight: 1.55, color: '#0a0a0a', fontWeight: 500 }}>
                  {ITEMS.length} piezas de {brandCount} sellos independientes orbitando en cuatro regiones. Selecciona una región y observa cada prenda elevarse desde la superficie del globo.
                </div>
              </div>
              <button
                onClick={onOpenLookbook}
                className="pac-cta"
                style={{ all: 'unset', cursor: 'pointer', display: 'inline-block', marginTop: 16, padding: '12px 32px', background: '#0a0a0a', color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: FONT }}
              >
                VER TODO EL LOOKBOOK →
              </button>
            </div>

            <div>
              <div style={{ fontSize: 10, letterSpacing: 2, color: '#0a0a0a', textTransform: 'uppercase', marginBottom: 8, fontWeight: 600, animation: 'pac-fade-in 500ms ease-out' }}>
                REGIONES / CATEGORÍAS
              </div>
              {CAT_ORDER.map((k, i) => {
                const m = CAT_META[k]
                const on = cats.includes(k)
                return (
                  <button key={k} onClick={() => toggleCat(k)}
                    className="pac-catbtn pac-catbtn-row"
                    style={{ all: 'unset', cursor: 'pointer', width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: '1px solid rgba(0,0,0,0.14)', color: '#0a0a0a', fontFamily: FONT, animation: `pac-fade-up 450ms cubic-bezier(.22,.61,.36,1) ${i * 60}ms backwards` }}>
                    <span style={{ fontSize: 11, fontWeight: on ? 700 : 500, letterSpacing: 1, width: 20, flexShrink: 0, fontVariantNumeric: 'tabular-nums', color: on ? '#0a0a0a' : 'rgba(0,0,0,0.5)' }}>{String(i + 1).padStart(2, '0')}</span>
                    <span style={{ width: 14, height: 14, flexShrink: 0, border: `1.5px solid ${on ? '#000' : 'rgba(0,0,0,0.4)'}`, background: on ? '#000' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 700, transition: 'background-color 150ms ease' }}>{on ? '✓' : ''}</span>
                    <span className="pac-catbtn-label" style={{ letterSpacing: 0.3, textTransform: 'uppercase', flex: 1, fontWeight: on ? 700 : 500, color: on ? '#0a0a0a' : 'rgba(0,0,0,0.5)', transition: 'font-weight 0ms, color 150ms ease' }}>{m.label}</span>
                    <span style={{ fontSize: 11, fontWeight: on ? 700 : 500, color: on ? '#0a0a0a' : 'rgba(0,0,0,0.5)', fontVariantNumeric: 'tabular-nums' }}>{String(counts[k] || 0).padStart(2, '0')}</span>
                  </button>
                )
              })}
              <div style={{ borderTop: '1px solid rgba(0,0,0,0.14)' }} />
              {active ? (
                <div style={{ display: 'flex', gap: S.xs, marginTop: S.xs, animation: 'pac-fade-in 200ms ease-out' }}>
                  <button
                    onClick={() => listItems.length > 0 && setOpen({ cats: [...cats], startId: listItems[0].id })}
                    className="pac-cta"
                    style={{ all: 'unset', cursor: 'pointer', flex: 1, textAlign: 'center', padding: '11px', background: '#0a0a0a', color: '#fff', fontWeight: 700, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: FONT }}>
                    ABRIR LOOKBOOK · {String(listItems.length).padStart(2, '0')} →
                  </button>
                  <button
                    onClick={() => setCats([])}
                    className="pac-catbtn"
                    style={{ all: 'unset', cursor: 'pointer', padding: '11px 18px', border: '1px solid #000', color: '#0a0a0a', fontWeight: 700, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: FONT }}>
                    LIMPIAR ✕
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: S.xs, fontSize: 11, letterSpacing: 1.5, color: '#0a0a0a', textTransform: 'uppercase' }}>
                  ↑ Selecciona una o más regiones para activar
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Right-side hover card — appears when hovering a spike with active category filter */}
      {gHoverItem && (
        <div key={gHoverItem.id} className="pac-hovercard" style={{ position: 'absolute', top: '50%', right: 56, transform: 'translateY(-50%)', width: 270, background: 'rgba(255,255,255,0.96)', border: '1px solid rgba(0,0,0,0.14)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', pointerEvents: 'none', zIndex: 10, animation: 'pac-scale-in 180ms ease-out' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 10, letterSpacing: 2, color: '#0a0a0a', textTransform: 'uppercase', fontWeight: 600, padding: '10px 14px 0' }}>
            <span style={{ fontWeight: 700, color: '#0a0a0a' }}>● EN ÓRBITA</span>
            <span>{CAT_META[gHoverItem.c].label}</span>
          </div>
          <div data-hovercard-img style={{ width: '100%', height: 280, marginTop: 8, overflow: 'hidden', background: '#ececef' }}>
            {gHoverItem.img && <img src={cdnResize(gHoverItem.img, 500)} alt={gHoverItem.n} onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
          </div>
          <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: '#0a0a0a', marginBottom: 5 }}>{gHoverItem.t}</div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', lineHeight: 1.3, marginBottom: S.xs }}>{gHoverItem.n}</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{gHoverItem.p}</div>
          </div>
        </div>
      )}

      {/* Footer band — instructions (left), totals (right) */}
      <div className="pac-footerband" style={{ position: 'absolute', bottom: 56, left: 56, right: 56, height: 56, zIndex: 10, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' }}>
        <span style={{ color: '#0a0a0a' }}>{active ? 'Click en una prenda para abrir el lookbook' : ''}</span>
        <span style={{ color: '#0a0a0a', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{String(ITEMS.length).padStart(2, '0')} PIEZAS / {String(brandCount).padStart(2, '0')} SELLOS</span>
      </div>

      {/* Category lookbook overlay */}
      {open && (
        <CatLookbook cats={open.cats} startId={open.startId} items={ITEMS} onClose={closeOpen} closing={openClosing} />
      )}

      {/* Mobile spike tap — liquid-glass card centered over a blurred globe, telling you
          what that spike was and offering a straight line to the product. X (or tapping
          the backdrop) dismisses it and you keep spinning the globe. */}
      {spikePreview && (
        <div
          onClick={() => setSpikePreview(null)}
          style={{
            position: 'absolute', inset: 0, zIndex: 60,
            background: 'rgba(20,20,18,0.32)',
            backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'pac-fade-in 180ms ease-out',
          }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative', width: 250, background: '#fff',
              border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 24px 56px rgba(0,0,0,0.32)',
              animation: 'pac-scale-in 220ms cubic-bezier(.22,.61,.36,1)',
            }}>
            <button onClick={() => setSpikePreview(null)} aria-label="Cerrar"
              style={{ all: 'unset', cursor: 'pointer', position: 'absolute', top: -14, right: -14, zIndex: 1, width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(0,0,0,0.2)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', fontFamily: FONT }}>✕</button>
            <div style={{ width: '100%', height: 320, background: '#ececef', overflow: 'hidden' }}>
              {spikePreview.img && <img src={cdnResize(spikePreview.img, 460)} alt={spikePreview.n} draggable="false" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div style={{ padding: '12px 14px 14px', borderTop: '1px solid rgba(0,0,0,0.12)' }}>
              <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'rgba(0,0,0,0.55)', textTransform: 'uppercase', fontWeight: 600 }}>{spikePreview.t} · {CAT_META[spikePreview.c].label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', lineHeight: 1.25, marginTop: 4 }}>{spikePreview.n}</div>
              <div style={{ fontSize: 13, fontWeight: 500, marginTop: 4 }}>{spikePreview.p || '—'}</div>
              <div
                onClick={() => { setSpikeProduct(PRODUCTS[spikePreview.id]); setSpikePreview(null) }}
                role="button" aria-label={`Ir al producto: ${spikePreview.n}`}
                style={{ marginTop: 10, padding: '12px', background: '#0a0a0a', color: '#fff', textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer' }}>
                IR AL PRODUCTO →
              </div>
            </div>
          </div>
        </div>
      )}

      {spikeProduct && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 70, background: '#fff', animation: 'pac-fade-up 320ms cubic-bezier(.22,.61,.36,1)' }}>
          <button onClick={() => setSpikeProduct(null)} aria-label="Cerrar producto" className="pac-closebtn" style={{ all: 'unset', cursor: 'pointer', position: 'absolute', top: 16, right: 18, zIndex: 80, width: 40, height: 40, border: '1px solid rgba(0,0,0,0.3)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, fontFamily: FONT }}>✕</button>
          <Suspense fallback={null}>
            <Product product={spikeProduct} />
          </Suspense>
        </div>
      )}

    </div>
  )
}
