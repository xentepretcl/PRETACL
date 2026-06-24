import { useEffect, useRef, useState, useMemo, useCallback, lazy, Suspense } from 'react'
import { PRODUCTS, BRANDS } from '../data'
import { S } from '../tokens'
import { cdnResize } from '../imgUtil'
import { useTilt } from '../useTilt'
import { useWishlist } from '../WishlistContext'
import { useAuth } from '../AuthContext'

const Product = lazy(() => import('./Product'))

const PRODUCT_EXIT_MS = 280

const FONT = '"Alte Haas Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif'

const CAT_META = {
  SUPERIOR:   { label: 'SUPERIOR',   sub: 'TOPS · POLERAS · CAMISAS',     lngC: -135 },
  INFERIOR:   { label: 'INFERIOR',   sub: 'FALDAS · PANTALONES · SHORTS', lngC: -45  },
  VESTIDOS:   { label: 'VESTIDOS',   sub: 'DRESSES · ENTEROS',            lngC: 45   },
  ACCESORIOS: { label: 'ACCESORIOS', sub: 'CAPS · BOLSOS · JOYAS',        lngC: 135  },
}
const CAT_ORDER = ['SUPERIOR', 'INFERIOR', 'VESTIDOS', 'ACCESORIOS']

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
function fibonacci(n) {
  const pts = [], gr = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(Math.max(0, 1 - y * y)), th = gr * i
    pts.push([Math.cos(th) * r, y, Math.sin(th) * r])
  }
  return pts
}

// ---- Decorative instrument grid: column hairlines, frame, rule lines ----
function GridFrame() {
  return (
    <div className="pac-grid" aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', top: 32, left: 32, right: 32, bottom: 32,
        border: '1px solid rgba(0,0,0,0.20)',
        backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.07) 1px, transparent 1px)',
        backgroundSize: 'calc((100% - 1px)/12) 100%',
      }} />
      <div style={{ position: 'absolute', top: 136, left: 32, right: 32, borderTop: '1px solid rgba(0,0,0,0.20)' }} />
      <div style={{ position: 'absolute', bottom: 128, left: 32, right: 32, borderTop: '1px solid rgba(0,0,0,0.20)' }} />
    </div>
  )
}

// ---- Globe canvas ----
function GlobeCanvas({ items, activeCats, hoverId, onHover, onPick, onFirstInteract, paused }) {
  const ref = useRef(null)
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

  const dots = useMemo(() => fibonacci(900), [])
  const spikes = useMemo(() => items.map(it => ({ it, v: vecLL(it.lng, it.lat) })), [items])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let dpr = Math.min(2, window.devicePixelRatio || 1)
    let W = window.innerWidth, H = window.innerHeight
    let cx = W / 2, cy = H / 2
    let R0 = Math.min(W, H) / 2.45

    function applySize() {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      W = window.innerWidth; H = window.innerHeight
      canvas.width = W * dpr; canvas.height = H * dpr
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const mobile = W < 768
      cx = mobile ? W / 2 : W / 2 + 50; cy = mobile ? H * 0.55 : H / 2
      R0 = Math.min(W, H) / (mobile ? 4.7 : 3.1)
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

    function rot(v, cosY, sinY) {
      const x = v[0] * cosY + v[2] * sinY, z = -v[0] * sinY + v[2] * cosY
      const y2 = v[1] * cosT - z * sinT, z2 = v[1] * sinT + z * cosT
      return [x, y2, z2]
    }

    let drag = null
    let pressTimer = null
    function hitTest(cx_, cy_) {
      const rect = canvas.getBoundingClientRect()
      const mx = cx_ - rect.left, my = cy_ - rect.top
      let best = null, bestD = 22
      for (const tip of tipsRef.current) {
        const d = Math.hypot(tip.tx - mx, tip.ty - my)
        if (d < bestD) { bestD = d; best = tip }
      }
      return best
    }

    const onDown = e => {
      drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, longPress: false }
      lastInteract = performance.now()
      onFirstInteractRef.current?.()
      onHoverRef.current(null)
      // Touch has no hover-before-press, so a long-press without movement opens the same
      // preview card the mouse gets for free on hover — lets touch users peek before committing.
      clearTimeout(pressTimer)
      pressTimer = setTimeout(() => {
        if (!drag || drag.moved) return
        const hit = hitTest(drag.sx, drag.sy)
        if (hit) { drag.longPress = true; onHoverRef.current({ id: hit.id }) }
      }, 450)
      try { canvas.setPointerCapture(e.pointerId) } catch (_) {}
    }
    const onMove = e => {
      const st = stRef.current
      if (drag) {
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
      const hit = hitTest(e.clientX, e.clientY)
      canvas.style.cursor = hit ? 'pointer' : 'grab'
      onHoverRef.current(hit ? { id: hit.id } : null)
      if (hit) lastInteract = performance.now()
    }
    const onUp = e => {
      clearTimeout(pressTimer)
      if (drag && !drag.moved && !drag.longPress) {
        const hit = hitTest(e.clientX, e.clientY)
        if (hit) onPickRef.current(hit.id, hit.cat)
      }
      drag = null; canvas.style.cursor = 'grab'
      lastInteract = performance.now()
    }
    canvas.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)

    function frame() {
      if (pausedRef.current) { raf = requestAnimationFrame(frame); return }
      const st = stRef.current
      if (st.anim < 1) st.anim = Math.min(1, st.anim + 0.045)
      const ease = 1 - Math.pow(1 - st.anim, 3)
      if (!reducedMotion && !drag && !st.hoverId && performance.now() - lastInteract > 900) {
        st.yaw += 0.00075
      }
      const cosY = Math.cos(st.yaw), sinY = Math.sin(st.yaw)
      cosT = Math.cos(st.pitch); sinT = Math.sin(st.pitch)
      const R = R0 * st.zoom

      ctx.clearRect(0, 0, W, H)

      // Globe disc — flat plate, instrument-grade rather than glossy sphere
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI)
      ctx.fillStyle = '#ffffff'; ctx.fill()
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.stroke()

      // Fibonacci dots
      for (const d of dots) {
        const r = rot(d, cosY, sinY)
        if (r[2] <= 0) continue
        const sx = cx + R * r[0], sy = cy - R * r[1]
        ctx.beginPath(); ctx.arc(sx, sy, 1.15, 0, 2 * Math.PI)
        ctx.fillStyle = `rgba(0,0,0,${0.10 + 0.42 * r[2]})`; ctx.fill()
      }

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
      for (let lat = -60; lat <= 60; lat += 30) drawArc('par', lat, lat === 0 ? 'rgba(0,0,0,0.16)' : 'rgba(0,0,0,0.08)', lat === 0 ? 1.1 : 1)
      for (let lng = -180; lng < 180; lng += 30) drawArc('mer', lng, 'rgba(0,0,0,0.08)', 1)

      // Sector meridians
      for (const lng of [-90, 0, 90, 180]) {
        ctx.beginPath(); let started = false
        for (let lat = -88; lat <= 88; lat += 4) {
          const r = rot(vecLL(lng, lat), cosY, sinY)
          if (r[2] <= 0.02) { started = false; continue }
          const sx = cx + R * r[0], sy = cy - R * r[1]
          if (!started) { ctx.moveTo(sx, sy); started = true } else ctx.lineTo(sx, sy)
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.14)'; ctx.lineWidth = 1; ctx.stroke()
      }

      // Product spikes
      const anyFilter = st.activeCats.length > 0
      const tips = []
      for (const sp of spikes) {
        const isActive = !anyFilter || st.activeCats.includes(sp.it.c)
        if (anyFilter && !isActive) continue
        const r = rot(sp.v, cosY, sinY)
        if (r[2] <= 0) continue
        const isHover = st.hoverId === sp.it.id
        const grow = anyFilter ? ease : 1
        const H = sp.it.h * grow * (anyFilter ? 1.25 : 0.62)
        const bx = cx + R * r[0], by = cy - R * r[1]
        const tx = cx + R * r[0] * (1 + H), ty = cy - R * r[1] * (1 + H)
        tips.push({ id: sp.it.id, cat: sp.it.c, tx, ty })
        const depth = 0.35 + 0.65 * r[2]
        let col, lw, tipR
        if (isHover) { col = 'rgba(0,0,0,1)'; lw = 2.4; tipR = 3.6 }
        else if (anyFilter) { col = `rgba(0,0,0,${0.55 * depth + 0.3})`; lw = 1.4; tipR = 2.1 }
        else { col = `rgba(0,0,0,${0.28 * depth})`; lw = 1; tipR = 1.4 }
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty)
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke()
        ctx.beginPath(); ctx.arc(tx, ty, tipR, 0, 2 * Math.PI)
        ctx.fillStyle = col; ctx.fill()
        if (isHover) {
          ctx.beginPath(); ctx.arc(tx, ty, 7, 0, 2 * Math.PI)
          ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 1.2; ctx.stroke()
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
    }
  }, [dots, spikes])

  return <canvas ref={ref} style={{ display: 'block', cursor: 'grab', touchAction: 'none', animation: 'pac-scale-in 700ms cubic-bezier(.22,.61,.36,1)' }} />
}

function CatTile({ it, isSel, delay, liked, style }) {
  const { ref, onPointerMove, onPointerLeave } = useTilt(6)
  return (
    <div data-lid={it.id} className="pac-tile" style={{ ...style, animation: `pac-scale-in 420ms cubic-bezier(.22,.61,.36,1) ${delay}ms backwards` }}>
      <div ref={ref} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} className="pac-tile-card" style={{ position: 'relative', background: '#ececef', overflow: 'hidden', width: '100%', height: '100%', borderRadius: 2, outline: isSel ? '2px solid #000' : '1px solid rgba(0,0,0,0.12)', outlineOffset: isSel ? 2 : 0, transition: 'outline-color 150ms ease, transform 260ms cubic-bezier(.22,.61,.36,1)' }}>
        {it.img && <img src={cdnResize(it.img, 460)} alt={it.n} width={230} height={305} loading="lazy" decoding="async" draggable={false} onError={(e) => { e.currentTarget.style.display = 'none' }} className="pac-tile-img" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 320ms cubic-bezier(.22,.61,.36,1)' }} />}
        <div data-heart={it.id} role="button" aria-pressed={liked} aria-label={liked ? 'Quitar de wishlist' : 'Agregar a wishlist'} style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, background: liked ? '#0a0a0a' : 'rgba(255,255,255,0.88)', color: liked ? '#fff' : '#0a0a0a', cursor: 'pointer' }}>
          {liked ? '♥' : '♡'}
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '10px 13px', background: 'rgba(255,255,255,0.92)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
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
  const list = useMemo(() => items.filter(i => cats.includes(i.c)), [items, cats])
  const [selId, setSelId] = useState(startId)
  const sel = list.find(i => i.id === selId) ?? list[0]
  const [product, setProduct] = useState(null)
  const [productClosing, setProductClosing] = useState(false)
  const { liked, toggle } = useWishlist()
  const closeProduct = useCallback(() => {
    setProductClosing(true)
    setTimeout(() => { setProduct(null); setProductClosing(false) }, PRODUCT_EXIT_MS)
  }, [])

  const ordered = useMemo(() => {
    const i = list.findIndex(x => x.id === selId)
    return i < 0 ? list : [...list.slice(i), ...list.slice(0, i)]
  }, [list, selId])

  const tileW = 230, tileH = 305, gap = 26
  const vw = window.innerWidth, vh = window.innerHeight - 74 - 132
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
          toggle(+heart.dataset.heart)
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
      <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: '#fff', color: '#0a0a0a', fontFamily: FONT, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 32px', animation: closing ? 'pac-scale-out 240ms ease-in forwards' : 'pac-scale-in 280ms cubic-bezier(.22,.61,.36,1)' }}>
        <button onClick={onClose} aria-label="Cerrar lookbook" className="pac-closebtn" style={{ all: 'unset', cursor: 'pointer', position: 'absolute', top: 16, right: 18, zIndex: 60, width: 40, height: 40, border: '1px solid rgba(0,0,0,0.3)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 }}>✕</button>
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
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: '#fff', color: '#0a0a0a', fontFamily: FONT, display: 'flex', flexDirection: 'column', animation: closing ? 'pac-scale-out 240ms ease-in forwards' : 'pac-scale-in 280ms cubic-bezier(.22,.61,.36,1)' }}>
      <div ref={vpRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: 'grab', touchAction: 'none', userSelect: 'none', background: '#f4f4f2' }}>
        <div ref={wrapRef} style={{ position: 'absolute', top: 0, left: 0, display: 'grid', gridTemplateColumns: 'max-content max-content', willChange: 'transform' }}>
          <CatBlock {...blockProps} /><CatBlock {...blockProps} aria />
          <CatBlock {...blockProps} aria /><CatBlock {...blockProps} aria />
        </div>
      </div>

      {/* Brand mark — floats over gallery, no background, matches the general lookbook. Kept outside
          the draggable viewport so its pointer capture doesn't swallow clicks meant for it / the close button. */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', padding: '22px 0', pointerEvents: 'none', zIndex: 55 }}>
        <div style={{ fontSize: 22, letterSpacing: 1, fontWeight: 700, color: '#fff', mixBlendMode: 'difference', animation: 'pac-fade-up 500ms cubic-bezier(.22,.61,.36,1)' }}>
          PRET-A-CL
        </div>
      </div>

      <button onClick={onClose} aria-label="Cerrar lookbook" className="pac-closebtn" style={{ all: 'unset', cursor: 'pointer', position: 'absolute', top: 16, right: 18, zIndex: 60, width: 40, height: 40, border: '1px solid rgba(0,0,0,0.3)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 }}>✕</button>

      {sel && (
        <div className="pac-lb-foot" style={{ height: 132, flexShrink: 0, borderTop: '1px solid rgba(0,0,0,0.14)', display: 'flex', alignItems: 'center', gap: S.md, padding: '0 24px', background: '#fff', overflow: 'hidden' }}>
          <div key={sel.id} style={{ display: 'flex', alignItems: 'center', gap: S.md, width: '100%', animation: 'pac-fade-up 220ms cubic-bezier(.22,.61,.36,1)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>Nº {String(selIdx + 1).padStart(2, '0')}</span>
            <div className="pac-lb-foot-thumb" style={{ width: 88, height: 100, flexShrink: 0, background: '#ececef', overflow: 'hidden' }}>
              {sel.img && <img src={cdnResize(sel.img, 180)} alt={sel.n} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="pac-lb-foot-brand" style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: '#0a0a0a', marginBottom: 4 }}>{sel.t} · {CAT_META[sel.c].label}</div>
              <div className="pac-lb-foot-name" style={{ fontSize: 16, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, lineHeight: 1.2, marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sel.n}</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{sel.p}</div>
            </div>
            {sel.url && (
              <a href={sel.url} target="_blank" rel="noopener noreferrer" className="pac-lb-foot-cta"
                style={{ all: 'unset', cursor: 'pointer', padding: '13px 24px', background: '#0a0a0a', color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: FONT, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {sel.p ? 'COMPRAR' : 'VER'} ↗ <span style={{ color: '#0a0a0a', marginLeft: 8 }}>{sel.t}</span>
              </a>
            )}
            <button onClick={() => toggle(sel.id)} aria-pressed={liked.has(sel.id)} aria-label={liked.has(sel.id) ? 'Quitar de wishlist' : 'Agregar a wishlist'}
              style={{ all: 'unset', cursor: 'pointer', width: 50, height: 50, flexShrink: 0, border: `1px solid ${liked.has(sel.id) ? '#0a0a0a' : 'rgba(0,0,0,0.3)'}`, background: liked.has(sel.id) ? '#0a0a0a' : 'transparent', color: liked.has(sel.id) ? '#fff' : '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
              {liked.has(sel.id) ? '♥' : '♡'}
            </button>
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
          <button onClick={closeProduct} aria-label="Cerrar producto" className="pac-closebtn" style={{ all: 'unset', cursor: 'pointer', position: 'absolute', top: 16, right: 18, zIndex: 80, width: 40, height: 40, border: '1px solid rgba(0,0,0,0.3)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 }}>✕</button>
          <Suspense fallback={null}>
            <Product product={product} />
          </Suspense>
        </div>
      )}
    </div>
  )
}

// ---- Globe home page ----
export default function Globe({ onOpenLookbook, onOpenWishlist, paused }) {
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
  const canvasPaused = paused || !!open

  const active = cats.length > 0
  const counts = useMemo(() => {
    const c = {}; ITEMS.forEach(i => { c[i.c] = (c[i.c] || 0) + 1 }); return c
  }, [])
  const listItems = useMemo(() => active ? ITEMS.filter(i => cats.includes(i.c)) : [], [cats, active])
  const brandCount = useMemo(() => new Set(ITEMS.map(i => i.t)).size, [])

  const activeRef = useRef(false); activeRef.current = active
  const gHoverItem = gHover ? ITEMS.find(i => i.id === gHover.id) : null

  const onGlobeHover = useCallback(h => {
    if (!h || !activeRef.current) { setGHover(null); setHoverId(null); return }
    setGHover({ id: h.id }); setHoverId(h.id)
  }, [])
  const onGlobePick = useCallback((id, cat) => {
    setGHover(null); setHoverId(null)
    setOpen({ cats: [cat], startId: id })
  }, [])
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

      {/* One-time drag affordance hint — dismissed permanently on first pointerdown on the globe */}
      {hintVisible && !canvasPaused && (
        <div aria-hidden="true" style={{
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
      <div className="pac-headerband" style={{ position: 'absolute', top: 56, left: 56, right: 56, height: 64, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', pointerEvents: 'none', animation: 'pac-fade-up 500ms cubic-bezier(.22,.61,.36,1)' }}>
        <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 32, lineHeight: 0.9, letterSpacing: 0.5 }}>
          PRET-A-CL<sup style={{ fontSize: 14 }}>©</sup>
        </span>
        <div className="pac-headerband-meta" style={{ display: 'flex', alignItems: 'baseline', gap: 26, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ color: '#0a0a0a' }}>SANTIAGO · 33°27′S 70°39′O</span>
          <button onClick={handleAccountClick} className="pac-cta"
            style={{ all: 'unset', pointerEvents: 'auto', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 13px', fontWeight: 700, fontFamily: FONT, color: '#fff', background: '#0a0a0a' }}>
            CUENTA
          </button>
        </div>
      </div>

      {/* Left editorial column: masthead + headline + intro (top) / numbered region index (bottom) */}
      <div className="pac-editorial">
        <div style={{ animation: 'pac-fade-up 600ms cubic-bezier(.22,.61,.36,1)' }}>
          <div style={{ fontSize: 10, letterSpacing: 2.5, color: '#0a0a0a', textTransform: 'uppercase', fontWeight: 600 }}>
            ÍNDICE ORBITAL · {ITEMS.length} PIEZAS
          </div>
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
          <div style={{ fontSize: 10, letterSpacing: 2, color: '#0a0a0a', textTransform: 'uppercase', marginBottom: 4, fontWeight: 600, animation: 'pac-fade-in 500ms ease-out' }}>
            REGIONES / CATEGORÍAS
          </div>
          {CAT_ORDER.map((k, i) => {
            const m = CAT_META[k]
            const on = cats.includes(k)
            return (
              <button key={k} onClick={() => toggleCat(k)}
                className="pac-catbtn pac-catbtn-row"
                style={{ all: 'unset', cursor: 'pointer', width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 16, padding: '9px 4px', borderTop: '1px solid rgba(0,0,0,0.14)', color: '#0a0a0a', fontFamily: FONT, animation: `pac-fade-up 450ms cubic-bezier(.22,.61,.36,1) ${i * 60}ms backwards` }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, width: 22, color: on ? '#0a0a0a' : '#0a0a0a', fontVariantNumeric: 'tabular-nums' }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ width: 15, height: 15, flexShrink: 0, border: `1.5px solid ${on ? '#000' : 'rgba(0,0,0,0.4)'}`, background: on ? '#000' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700, transition: 'background-color 150ms ease' }}>{on ? '✓' : ''}</span>
                <span className="pac-catbtn-label" style={{ fontWeight: 700, fontSize: 20, letterSpacing: -0.4, textTransform: 'uppercase', flex: 1 }}>{m.label}</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: '#0a0a0a', fontVariantNumeric: 'tabular-nums' }}>{String(counts[k] || 0).padStart(2, '0')}</span>
              </button>
            )
          })}
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.14)' }} />
          {active ? (
            <div style={{ display: 'flex', gap: S.xs, marginTop: 10, animation: 'pac-fade-up 280ms cubic-bezier(.22,.61,.36,1)' }}>
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
            <div style={{ marginTop: 10, fontSize: 11, letterSpacing: 1.5, color: '#0a0a0a', textTransform: 'uppercase' }}>
              ↑ Selecciona una o más regiones para activar
            </div>
          )}
        </div>
      </div>

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

    </div>
  )
}
