import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { PRODUCTS, BRANDS } from '../data'
import { S } from '../tokens'
import { cdnResize } from '../imgUtil'
import { useTilt } from '../useTilt'

const FONT = '"Alte Haas Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif'

const CAT_META = {
  SUPERIOR:   { label: 'SUPERIOR',   sub: 'TOPS · POLERAS · CAMISAS',     lngC: -135 },
  INFERIOR:   { label: 'INFERIOR',   sub: 'FALDAS · PANTALONES · SHORTS', lngC: -45  },
  VESTIDOS:   { label: 'VESTIDOS',   sub: 'DRESSES · ENTEROS',            lngC: 45   },
  ACCESORIOS: { label: 'ACCESORIOS', sub: 'CAPS · BOLSOS · JOYAS',        lngC: 135  },
}
const CAT_ORDER = ['SUPERIOR', 'INFERIOR', 'VESTIDOS', 'ACCESORIOS']

function classify(name) {
  const n = name.toLowerCase()
  if (/vestido|dress|entero|jumpsuit|jumper pliss|maxi puffy|ola dress|sade dress/.test(n)) return 'VESTIDOS'
  if (/falda|pantalon|jean|short|bermuda|pollera|legging|jeans|bikini|tanga/.test(n)) return 'INFERIOR'
  if (/gorro|gorra|\bcap\b|zapato|shoe|bolso|\bbag\b|belt|bufanda|tote|case|bandana|joya|baguette|slipmat|loafer|headphone|cartera/.test(n)) return 'ACCESORIOS'
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
  const c = classify(p.name)
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

// ---- Brand ticker ----
const BRAND_NAMES = Object.values(BRANDS).map(b => b.name)

function BrandTicker() {
  const items = [...BRAND_NAMES, ...BRAND_NAMES]
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
      height: 44, background: '#0a0a0a', overflow: 'hidden',
      display: 'flex', alignItems: 'center',
    }}>
      <style>{`@keyframes brand-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
      <div style={{
        display: 'flex', whiteSpace: 'nowrap', willChange: 'transform',
        animation: 'brand-scroll 28s linear infinite',
      }}>
        {items.map((name, i) => (
          <span key={i} style={{
            display: 'inline-flex', alignItems: 'center',
            paddingRight: 48,
            fontSize: 10, fontWeight: 700, letterSpacing: 3.5,
            textTransform: 'uppercase', color: '#fff', fontFamily: FONT,
            flexShrink: 0,
          }}>
            {name}
            <span style={{ marginLeft: 48, color: 'rgba(255,255,255,0.25)', fontSize: 7 }}>◆</span>
          </span>
        ))}
      </div>
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
      cx = W / 2; cy = mobile ? H * 0.55 : H / 2
      R0 = Math.min(W, H) / (mobile ? 4.7 : 2.45)
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
    const onWheel = e => {
      e.preventDefault()
      stRef.current.zoom = Math.max(0.7, Math.min(2.6, stRef.current.zoom * (e.deltaY < 0 ? 1.08 : 0.926)))
      lastInteract = performance.now()
    }

    canvas.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })

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

      // Globe disc — subtle rim shading so the sphere reads as dimensional, not a flat disc
      const sphereGrad = ctx.createRadialGradient(cx - R * 0.32, cy - R * 0.38, R * 0.1, cx, cy, R * 1.02)
      sphereGrad.addColorStop(0, '#ffffff')
      sphereGrad.addColorStop(0.72, '#ffffff')
      sphereGrad.addColorStop(1, 'rgba(10,10,10,0.05)')
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI)
      ctx.fillStyle = sphereGrad; ctx.fill()
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.stroke()

      // Fibonacci dots
      for (const d of dots) {
        const r = rot(d, cosY, sinY)
        if (r[2] <= 0) continue
        const sx = cx + R * r[0], sy = cy - R * r[1]
        ctx.beginPath(); ctx.arc(sx, sy, 1.15, 0, 2 * Math.PI)
        ctx.fillStyle = `rgba(0,0,0,${0.10 + 0.42 * r[2]})`; ctx.fill()
      }

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
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [dots, spikes])

  return <canvas ref={ref} style={{ display: 'block', cursor: 'grab', touchAction: 'none', animation: 'pac-scale-in 700ms cubic-bezier(.22,.61,.36,1)' }} />
}

function CatTile({ it, isSel, delay, style }) {
  const { ref, onPointerMove, onPointerLeave } = useTilt(6)
  return (
    <div data-lid={it.id} className="pac-tile" style={{ ...style, animation: `pac-scale-in 420ms cubic-bezier(.22,.61,.36,1) ${delay}ms backwards` }}>
      <div ref={ref} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} className="pac-tile-card" style={{ position: 'relative', background: '#ececef', overflow: 'hidden', width: '100%', height: '100%', borderRadius: 2, outline: isSel ? '2px solid #000' : 'none', outlineOffset: 2, transition: 'outline-color 150ms ease, transform 260ms cubic-bezier(.22,.61,.36,1)' }}>
        {it.img && <img src={cdnResize(it.img, 460)} alt={it.n} width={230} height={305} loading="lazy" decoding="async" draggable={false} onError={(e) => { e.currentTarget.style.display = 'none' }} className="pac-tile-img" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 320ms cubic-bezier(.22,.61,.36,1)' }} />}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '10px 13px', background: 'linear-gradient(0deg,rgba(255,255,255,0.94),rgba(255,255,255,0))', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <span style={{ color: '#0a0a0a', fontWeight: 700, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.n}</span>
          <span style={{ color: '#555', fontWeight: 500, fontSize: 10, whiteSpace: 'nowrap', marginLeft: 6 }}>{it.p}</span>
        </div>
      </div>
    </div>
  )
}

function CatBlock({ aria, blockW, blockH, cells, ordered, n, cols, colStep, rowStep, tileW, tileH, selId }) {
  return (
    <div aria-hidden={aria || undefined} style={{ position: 'relative', width: blockW, height: blockH }}>
      {Array.from({ length: cells }).map((_, idx) => {
        const it = ordered[idx % n]
        const col = idx % cols, row = Math.floor(idx / cols)
        const isSel = !aria && it.id === selId && idx < n
        const delay = ((col + row) % 7) * 45
        return (
          <CatTile key={idx} it={it} isSel={isSel} delay={delay}
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
        const tile = hit?.closest('[data-lid]')
        if (tile) setSelId(+tile.dataset.lid)
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

  const label = cats.map(c => CAT_META[c].label).join(' + ')
  const blockProps = { blockW, blockH, cells, ordered, n, cols, colStep, rowStep, tileW, tileH, selId: sel?.id }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: '#fff', color: '#0a0a0a', fontFamily: FONT, display: 'flex', flexDirection: 'column', animation: closing ? 'pac-scale-out 240ms ease-in forwards' : 'pac-scale-in 280ms cubic-bezier(.22,.61,.36,1)' }}>
      <div className="pac-lb-header" style={{ height: 74, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 28px', borderBottom: '1px solid rgba(0,0,0,0.14)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, minWidth: 0, overflow: 'hidden' }}>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: 1, flexShrink: 0 }}>PRET-A-CL</span>
          <span className="pac-lb-sub" style={{ fontWeight: 500, fontSize: 13, letterSpacing: 2, color: '#6a6a72', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            LOOKBOOK · {label} ({list.length} PIEZAS)
          </span>
        </div>
        <button onClick={onClose} aria-label="Cerrar lookbook" className="pac-closebtn" style={{ all: 'unset', cursor: 'pointer', width: 38, height: 38, flexShrink: 0, border: '1px solid rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 }}>✕</button>
      </div>

      <div ref={vpRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: 'grab', touchAction: 'none', userSelect: 'none', background: '#f4f4f2' }}>
        <div ref={wrapRef} style={{ position: 'absolute', top: 0, left: 0, display: 'grid', gridTemplateColumns: 'max-content max-content', willChange: 'transform' }}>
          <CatBlock {...blockProps} /><CatBlock {...blockProps} aria />
          <CatBlock {...blockProps} aria /><CatBlock {...blockProps} aria />
        </div>
      </div>

      {sel && (
        <div className="pac-lb-foot" style={{ height: 132, flexShrink: 0, borderTop: '1px solid rgba(0,0,0,0.14)', display: 'flex', alignItems: 'center', gap: S.md, padding: '0 24px', background: '#fff', overflow: 'hidden' }}>
          <div key={sel.id} style={{ display: 'flex', alignItems: 'center', gap: S.md, width: '100%', animation: 'pac-fade-up 220ms cubic-bezier(.22,.61,.36,1)' }}>
            <div className="pac-lb-foot-thumb" style={{ width: 88, height: 100, flexShrink: 0, background: '#ececef', overflow: 'hidden' }}>
              {sel.img && <img src={cdnResize(sel.img, 180)} alt={sel.n} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="pac-lb-foot-brand" style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: '#6a6a72', marginBottom: 4 }}>{sel.t}</div>
              <div className="pac-lb-foot-name" style={{ fontSize: 16, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, lineHeight: 1.2, marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sel.n}</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{sel.p}</div>
            </div>
            {sel.url && (
              <a href={sel.url} target="_blank" rel="noopener noreferrer" className="pac-lb-foot-cta"
                style={{ all: 'unset', cursor: 'pointer', padding: '13px 24px', background: '#0a0a0a', color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: FONT, whiteSpace: 'nowrap', flexShrink: 0 }}>
                VER PRENDA →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Globe home page ----
export default function Globe({ onOpenLookbook, paused }) {
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

  return (
    <div className="pac-viewport" style={{ position: 'relative', background: '#fff', color: '#0a0a0a', fontFamily: FONT, overflow: 'hidden' }}>
      {/* Brand ticker — top strip */}
      <BrandTicker />

      {/* Full-screen globe canvas */}
      <GlobeCanvas items={ITEMS} activeCats={cats} hoverId={hoverId} onHover={onGlobeHover} onPick={onGlobePick} onFirstInteract={dismissHint} paused={canvasPaused} />

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
          <div style={{ fontSize: 10, letterSpacing: 1.5, color: '#6a6a72', textTransform: 'uppercase', fontWeight: 700 }}>
            ARRASTRA PARA EXPLORAR
          </div>
        </div>
      )}

      {/* Top-left: brand + intro */}
      <div className="pac-hero" style={{ pointerEvents: 'none', animation: 'pac-fade-up 600ms cubic-bezier(.22,.61,.36,1)' }}>
        <div style={{ fontSize: 10, letterSpacing: 1.5, color: '#6a6a72', textTransform: 'uppercase' }}>
          PLATAFORMA DE MODA CHILENA, DESDE 2026
        </div>
        <div className="pac-hero-display" style={{ textTransform: 'uppercase', marginTop: 16, fontWeight: 700 }}>
          PRET-<br />A-CL©
        </div>
        <div style={{ marginTop: 22, maxWidth: 440 }}>
          <div style={{ fontSize: 18, lineHeight: 1.4, letterSpacing: 0.3, textTransform: 'uppercase', fontWeight: 700 }}>
            NO ES RETAIL. ES CULTO.
          </div>
          <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.6, color: '#6a6a72', fontWeight: 500 }}>
            {ITEMS.length} piezas de {brandCount} marcas independientes orbitando en cuatro regiones.
          </div>
        </div>
        <button
          onClick={onOpenLookbook}
          className="pac-cta"
          style={{ all: 'unset', cursor: 'pointer', display: 'inline-block', marginTop: 28, padding: `${S.sm}px ${S.lg}px`, background: '#0a0a0a', color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: FONT, pointerEvents: 'all' }}
        >
          VER TODO EL LOOKBOOK →
        </button>
      </div>

      {/* Bottom-left: category filters */}
      <div className="pac-catpanel" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 10, letterSpacing: 1.5, color: '#6a6a72', textTransform: 'uppercase', marginBottom: 4, animation: 'pac-fade-in 500ms ease-out' }}>
          REGIONES / CATEGORÍAS · SELECCIÓN MÚLTIPLE
        </div>
        {CAT_ORDER.map((k, i) => {
          const m = CAT_META[k]
          const on = cats.includes(k)
          return (
            <button key={k} onClick={() => toggleCat(k)}
              className="pac-catbtn pac-catbtn-row"
              style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: S.sm, padding: '12px 18px', border: `1px solid ${on ? '#000' : 'rgba(0,0,0,0.22)'}`, background: on ? '#0a0a0a' : 'rgba(255,255,255,0.8)', color: on ? '#fff' : '#0a0a0a', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', fontFamily: FONT, animation: `pac-fade-up 450ms cubic-bezier(.22,.61,.36,1) ${i * 60}ms backwards` }}>
              <span style={{ width: 16, height: 16, flexShrink: 0, border: `1px solid ${on ? '#fff' : 'rgba(0,0,0,0.5)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: on ? '#000' : 'transparent', background: on ? '#fff' : 'transparent', transition: 'background-color 150ms ease, color 150ms ease' }}>{on ? '✓' : ''}</span>
              <span style={{ fontSize: 10, fontWeight: 500, width: 28, color: on ? '#aaa' : '#6a6a72' }}>{String(counts[k] || 0).padStart(2, '0')}</span>
              <span className="pac-catbtn-label" style={{ fontWeight: 700, fontSize: 18, letterSpacing: 0.5, textTransform: 'uppercase', flex: 1 }}>{m.label}</span>
            </button>
          )
        })}
        {active && (
          <div style={{ display: 'flex', gap: S.xs, marginTop: 2, animation: 'pac-fade-up 280ms cubic-bezier(.22,.61,.36,1)' }}>
            <button
              onClick={() => listItems.length > 0 && setOpen({ cats: [...cats], startId: listItems[0].id })}
              className="pac-cta"
              style={{ all: 'unset', cursor: 'pointer', flex: 1, textAlign: 'center', padding: '12px', background: '#0a0a0a', color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: FONT }}>
              VER SELECCIÓN · {listItems.length} →
            </button>
            <button
              onClick={() => setCats([])}
              className="pac-catbtn"
              style={{ all: 'unset', cursor: 'pointer', padding: '12px 16px', border: '1px solid rgba(0,0,0,0.3)', color: '#0a0a0a', fontWeight: 700, fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: FONT, background: 'rgba(255,255,255,0.8)' }}>
              LIMPIAR ✕
            </button>
          </div>
        )}
      </div>

      {/* Right-side hover card — appears when hovering a spike with active category filter */}
      {gHoverItem && (
        <div key={gHoverItem.id} className="pac-hovercard" style={{ position: 'absolute', top: '50%', right: 56, transform: 'translateY(-50%)', width: 250, background: 'rgba(255,255,255,0.96)', border: '1px solid rgba(0,0,0,0.14)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', pointerEvents: 'none', zIndex: 10, animation: 'pac-scale-in 180ms ease-out' }}>
          <div data-hovercard-img style={{ width: '100%', height: 280, overflow: 'hidden', background: '#ececef' }}>
            {gHoverItem.img && <img src={cdnResize(gHoverItem.img, 500)} alt={gHoverItem.n} onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
          </div>
          <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: '#6a6a72', marginBottom: 5 }}>{gHoverItem.t}</div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', lineHeight: 1.3, marginBottom: S.xs }}>{gHoverItem.n}</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{gHoverItem.p}</div>
          </div>
        </div>
      )}

      {/* Category lookbook overlay */}
      {open && (
        <CatLookbook cats={open.cats} startId={open.startId} items={ITEMS} onClose={closeOpen} closing={openClosing} />
      )}

    </div>
  )
}
