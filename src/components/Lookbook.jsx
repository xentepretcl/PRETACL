import { useRef, useEffect, useState } from 'react'
import { PRODUCTS, BRANDS } from '../data'
import { T } from '../tokens'
import { cdnResize } from '../imgUtil'
import { useTilt } from '../useTilt'
import { useWishlist } from '../WishlistContext'

function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return mobile
}

function HeartBadge({ pid, liked, onClick }) {
  return (
    <div
      data-heart={pid}
      role="button"
      aria-pressed={liked}
      aria-label={liked ? 'Quitar de wishlist' : 'Agregar a wishlist'}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick() } : undefined}
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 2,
        width: 26,
        height: 26,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        background: liked ? T.ink : 'rgba(255,255,255,0.88)',
        color: liked ? '#fff' : T.ink,
        cursor: 'pointer',
      }}
    >
      {liked ? '♥' : '♡'}
    </div>
  )
}

function Tile({ p, pid, style, liked, onOpen, onToggleHeart }) {
  const b = BRANDS[p.brand]
  const { ref, onPointerMove, onPointerLeave } = useTilt(6)
  return (
    <div
      data-idx={pid}
      className="pac-tile"
      style={style}
      onClick={onOpen}
    >
      <div
        ref={ref}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        className="pac-tile-card"
        style={{
          position: 'relative',
          background: '#e8e8e6',
          overflow: 'hidden',
          width: '100%',
          height: '100%',
        }}
      >
        <HeartBadge pid={pid} liked={liked} onClick={onToggleHeart} />
        <img
          src={cdnResize(p.img, 460)}
          alt={p.name}
          width={230}
          height={320}
          loading="lazy"
          decoding="async"
          draggable="false"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
          className="pac-tile-img"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            userSelect: 'none',
            willChange: 'transform',
            transition: 'transform 320ms cubic-bezier(.22,.61,.36,1)',
          }}
        />
        <div style={{
          position: 'absolute',
          left: -1,
          right: -1,
          bottom: -1,
          background: 'rgba(255,255,255,0.92)',
          padding: '10px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 8,
          fontFamily: T.font,
          pointerEvents: 'none',
        }}>
          <span style={{
            fontWeight: 700,
            fontSize: 10,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {p.name}
          </span>
          <span style={{
            fontWeight: 500,
            fontSize: 10,
            letterSpacing: 0.5,
            color: T.ink2,
            whiteSpace: 'nowrap',
            textTransform: 'uppercase',
          }}>
            {b.name}
          </span>
        </div>
      </div>
    </div>
  )
}

// Virtualized infinite drag grid — only mounts tiles near the viewport (+small
// buffer) instead of pre-rendering the whole catalog as one giant translated
// sheet. `cols` sets the horizontal wallpaper-repeat period, `rows` sets the
// vertical period (Lookbook passes ceil(catalog/cols) so every item gets a
// unique cell, same coverage as before — just rendered on demand).
function DragLookbook({ vw, vh, tileW = 230, tileH = 320, cols = 7, rows = 4, gap = 14, onTile, list: listProp }) {
  const list = listProp || PRODUCTS
  const { liked, toggle } = useWishlist()
  const colStep = tileW + gap
  const rowStep = tileH + gap
  const totalRows = Math.max(rows, 1)

  const vpRef = useRef(null)
  const wrapRef = useRef(null)
  const onTileRef = useRef(onTile)
  onTileRef.current = onTile
  const toggleRef = useRef(toggle)
  toggleRef.current = toggle

  const originRef = useRef({ col: 0, row: 0 })
  const [origin, setOrigin] = useState(originRef.current)
  const sub = useRef({ x: 0, y: 0 })
  const vel = useRef({ x: 0, y: 0 })
  const drag = useRef(null)
  const raf = useRef(0)

  const paint = () => {
    if (wrapRef.current) {
      wrapRef.current.style.transform = `translate3d(${sub.current.x}px, ${sub.current.y}px, 0)`
    }
  }

  // Keep sub-pixel offset bounded to one cell — anything beyond that shifts
  // the integer origin instead, which is what triggers remounting the
  // (small, fixed-size) visible tile window.
  const settle = () => {
    let shifted = false
    while (sub.current.x > colStep) { originRef.current.col -= 1; sub.current.x -= colStep; shifted = true }
    while (sub.current.x < -colStep) { originRef.current.col += 1; sub.current.x += colStep; shifted = true }
    while (sub.current.y > rowStep) { originRef.current.row -= 1; sub.current.y -= rowStep; shifted = true }
    while (sub.current.y < -rowStep) { originRef.current.row += 1; sub.current.y += rowStep; shifted = true }
    if (shifted) setOrigin({ ...originRef.current })
  }

  useEffect(() => {
    paint()
    const el = vpRef.current
    if (!el) return

    const onDown = (e) => {
      e.stopPropagation()
      drag.current = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: Date.now() }
      vel.current = { x: 0, y: 0 }
      cancelAnimationFrame(raf.current)
      el.style.cursor = 'grabbing'
      try { el.setPointerCapture(e.pointerId) } catch (_) {}
    }

    const onMove = (e) => {
      if (!drag.current) return
      const dx = e.clientX - drag.current.x
      const dy = e.clientY - drag.current.y
      drag.current.x = e.clientX
      drag.current.y = e.clientY
      sub.current.x += dx
      sub.current.y += dy
      vel.current = { x: dx, y: dy }
      paint()
      settle()
    }

    const onUp = (e) => {
      if (!drag.current) return
      const moved = Math.hypot(
        (e.clientX ?? drag.current.x) - drag.current.sx,
        (e.clientY ?? drag.current.y) - drag.current.sy
      )
      if (moved < 6 && Date.now() - drag.current.t < 400) {
        const hit = document.elementFromPoint(e.clientX, e.clientY)
        const heart = hit && hit.closest && hit.closest('[data-heart]')
        if (heart) {
          toggleRef.current(+heart.dataset.heart)
        } else {
          const tile = hit && hit.closest && hit.closest('[data-idx]')
          if (tile && onTileRef.current) onTileRef.current(PRODUCTS[+tile.dataset.idx])
        }
      }
      drag.current = null
      el.style.cursor = 'grab'
      const decay = () => {
        vel.current.x *= 0.91
        vel.current.y *= 0.91
        sub.current.x += vel.current.x
        sub.current.y += vel.current.y
        paint()
        settle()
        if (Math.abs(vel.current.x) > 0.3 || Math.abs(vel.current.y) > 0.3) {
          raf.current = requestAnimationFrame(decay)
        }
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
  }, [])

  const bufC = 2
  const bufR = 2
  const visCols = Math.ceil(vw / colStep) + bufC * 2
  const visRows = Math.ceil(vh / rowStep) + bufR * 2 + 1

  const tiles = []
  for (let c = -bufC; c < visCols - bufC; c++) {
    const col = origin.col + c
    const lc = ((col % cols) + cols) % cols
    const oddCol = (((col % 2) + 2) % 2) === 1
    const x = c * colStep
    for (let r = -bufR; r < visRows - bufR; r++) {
      const row = origin.row + r
      const lr = ((row % totalRows) + totalRows) % totalRows
      const localIdx = (lc * totalRows + lr) % list.length
      const item = list[localIdx]
      const pid = PRODUCTS.indexOf(item)
      const y = r * rowStep + (oddCol ? rowStep / 2 : 0)
      tiles.push(
        <Tile
          key={`${col}:${row}`}
          p={item}
          pid={pid}
          liked={liked.has(pid)}
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width: tileW,
            height: tileH,
          }}
        />
      )
    }
  }

  return (
    <div
      ref={vpRef}
      style={{
        position: 'relative',
        width: vw,
        height: vh,
        overflow: 'hidden',
        background: '#fff',
        cursor: 'grab',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      <div
        ref={wrapRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          willChange: 'transform',
        }}
      >
        {tiles}
      </div>
    </div>
  )
}

// Plain, non-repeating grid — used for curated subsets (e.g. wishlist) where
// tiling the same handful of items into an infinite drag-wallpaper would look broken.
function StaticGrid({ items, onTile }) {
  const { liked, toggle } = useWishlist()
  const mobile = useIsMobile()
  const tileW = mobile ? 185 : 230
  const tileH = mobile ? 248 : 320
  const gap = mobile ? 8 : 26
  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      boxSizing: 'border-box',
      padding: mobile ? '76px 14px 24px' : '96px 40px 40px',
      display: 'flex',
      flexWrap: 'wrap',
      gap,
      justifyContent: 'center',
      alignContent: 'flex-start',
    }}>
      {items.map((p) => {
        const pid = PRODUCTS.indexOf(p)
        return (
          <Tile
            key={pid}
            p={p}
            pid={pid}
            liked={liked.has(pid)}
            onOpen={() => onTile(p)}
            onToggleHeart={() => toggle(pid)}
            style={{ width: tileW, height: tileH, cursor: 'pointer', animation: 'pac-scale-in 320ms cubic-bezier(.22,.61,.36,1) backwards' }}
          />
        )
      })}
    </div>
  )
}

export default function Lookbook({ onProduct, list, label, emptyTitle, emptySub }) {
  const items = list ?? PRODUCTS
  const mobile = useIsMobile()
  const dragTileW = mobile ? 185 : 230
  const dragTileH = mobile ? 248 : 320
  const dragGap = mobile ? 8 : 26
  const dragCols = mobile ? 4 : 6

  if (items.length === 0) {
    return (
      <div className="pac-viewport" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        fontFamily: T.font,
        fontWeight: 700,
        padding: '0 32px',
      }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>♡</div>
        <div style={{ fontSize: 30, letterSpacing: -0.5, textTransform: 'uppercase' }}>
          {emptyTitle || 'Tu wishlist está vacía'}
        </div>
        <div style={{ fontSize: 13, letterSpacing: 1, color: T.ink2, textTransform: 'uppercase', marginTop: 14, maxWidth: 420, lineHeight: 1.6, fontWeight: 500 }}>
          {emptySub || 'Abre un lookbook y toca el corazón ♥ en cualquier prenda para guardarla aquí.'}
        </div>
      </div>
    )
  }

  return (
    <div className="pac-viewport" style={{
      overflow: 'hidden',
      position: 'relative',
      fontFamily: T.font,
      fontWeight: 700,
    }}>
      {list != null ? (
        <StaticGrid items={items} onTile={onProduct} />
      ) : (
        <DragLookbook
          vw={typeof window !== 'undefined' ? window.innerWidth : 1920}
          vh={typeof window !== 'undefined' ? window.innerHeight : 1080}
          tileW={dragTileW}
          tileH={dragTileH}
          cols={dragCols}
          rows={Math.ceil(items.length / dragCols)}
          gap={dragGap}
          onTile={onProduct}
          list={items}
        />
      )}

      {/* Glass edges — same frosted blur as the category lookbook, so both feel like one surface */}
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

      {/* Brand mark — floats over gallery, no background */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        padding: '22px 0',
        pointerEvents: 'none',
      }}>
        <div style={{
          fontFamily: T.brandFont,
          fontSize: 28,
          letterSpacing: 1,
          fontWeight: 700,
          color: '#fff',
          mixBlendMode: 'difference',
          animation: 'pac-fade-up 500ms cubic-bezier(.22,.61,.36,1)',
        }}>
          {label || 'PRET-A-CL'}
        </div>
      </div>
    </div>
  )
}
