import { useRef, useEffect } from 'react'
import { PRODUCTS, BRANDS } from '../data'
import { T } from '../tokens'
import { cdnResize } from '../imgUtil'
import { useTilt } from '../useTilt'

function Tile({ p, idx, style }) {
  const b = BRANDS[p.brand]
  const { ref, onPointerMove, onPointerLeave } = useTilt(6)
  return (
    <div
      data-idx={idx}
      className="pac-tile"
      style={style}
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
          left: 0,
          right: 0,
          bottom: 0,
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

function DragLookbook({ vw, vh, tileW = 230, tileH = 320, cols = 7, rows = 4, gap = 14, onTile }) {
  const list = PRODUCTS
  const colStep = tileW + gap
  const rowStep = tileH + gap
  const blockW = cols * colStep
  const blockH = rows * rowStep

  const vpRef = useRef(null)
  const wrapRef = useRef(null)
  const onTileRef = useRef(onTile)
  onTileRef.current = onTile
  const off = useRef({ x: -blockW / 4, y: -blockH / 4 })
  const vel = useRef({ x: 0, y: 0 })
  const drag = useRef(null)
  const raf = useRef(0)

  const paint = () => {
    let x = off.current.x % blockW
    if (x > 0) x -= blockW
    let y = off.current.y % blockH
    if (y > 0) y -= blockH
    if (wrapRef.current) {
      wrapRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`
    }
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
      off.current.x += dx
      off.current.y += dy
      vel.current = { x: dx, y: dy }
      paint()
    }

    const onUp = (e) => {
      if (!drag.current) return
      const moved = Math.hypot(
        (e.clientX ?? drag.current.x) - drag.current.sx,
        (e.clientY ?? drag.current.y) - drag.current.sy
      )
      if (moved < 6 && Date.now() - drag.current.t < 400 && onTileRef.current) {
        const hit = document.elementFromPoint(e.clientX, e.clientY)
        const tile = hit && hit.closest && hit.closest('[data-idx]')
        if (tile) onTileRef.current(PRODUCTS[+tile.dataset.idx])
      }
      drag.current = null
      el.style.cursor = 'grab'
      const decay = () => {
        vel.current.x *= 0.91
        vel.current.y *= 0.91
        off.current.x += vel.current.x
        off.current.y += vel.current.y
        paint()
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

  const renderBlock = (ariaHidden) => (
    <div
      aria-hidden={ariaHidden || undefined}
      style={{ position: 'relative', width: blockW, height: blockH }}
    >
      {Array.from({ length: cols }).map((_, c) => (
        <div
          key={c}
          style={{
            position: 'absolute',
            left: c * colStep,
            top: 0,
            width: tileW,
            transform: c % 2 ? `translateY(${rowStep / 2}px)` : 'none',
            contain: 'strict',
            height: (rows + 1) * rowStep,
          }}
        >
          {Array.from({ length: rows + 1 }).map((_, r) => {
            const idx = (c * rows + r) % list.length
            const delay = ((c + r) % 7) * 45
            return (
              <Tile
                key={r}
                p={list[idx]}
                idx={idx}
                style={{
                  position: 'absolute',
                  top: r * rowStep,
                  left: 0,
                  width: tileW,
                  height: tileH,
                  animation: `pac-scale-in 420ms cubic-bezier(.22,.61,.36,1) ${delay}ms backwards`,
                }}
              />
            )
          })}
        </div>
      ))}
    </div>
  )

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
          display: 'grid',
          gridTemplateColumns: 'max-content max-content',
          gridAutoRows: 'max-content',
          willChange: 'transform',
        }}
      >
        {renderBlock(false)}
        {renderBlock(true)}
        {renderBlock(true)}
        {renderBlock(true)}
      </div>

    </div>
  )
}

export default function Lookbook({ onProduct }) {
  return (
    <div className="pac-viewport" style={{
      overflow: 'hidden',
      position: 'relative',
      fontFamily: T.font,
      fontWeight: 700,
    }}>
      <DragLookbook
        vw={typeof window !== 'undefined' ? window.innerWidth : 1920}
        vh={typeof window !== 'undefined' ? window.innerHeight : 1080}
        tileW={230}
        tileH={320}
        cols={6}
        rows={4}
        gap={26}
        onTile={onProduct}
      />

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
          fontSize: 22,
          letterSpacing: 1,
          fontWeight: 700,
          color: '#fff',
          mixBlendMode: 'difference',
          animation: 'pac-fade-up 500ms cubic-bezier(.22,.61,.36,1)',
        }}>
          PRET-A-CL
        </div>
      </div>
    </div>
  )
}
