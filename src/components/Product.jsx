import { useRef, useState, useEffect, useCallback } from 'react'
import { BRANDS, PRODUCTS } from '../data'
import { T, S } from '../tokens'
import { cdnResize } from '../imgUtil'
import { useWishlist } from '../WishlistContext'
import { useAuth } from '../AuthContext'

function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return mobile
}

function LoginHint({ onLogin, font }) {
  return (
    <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: '#0a0a0a', color: '#fff', display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', whiteSpace: 'nowrap', fontFamily: font, animation: 'pac-fade-up 200ms ease-out' }}>
      <span style={{ fontSize: 12, letterSpacing: 0.5 }}>Inicia sesión para guardar prendas</span>
      <button onClick={onLogin} style={{ all: 'unset', cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', textDecoration: 'underline', textUnderlineOffset: 3 }}>INGRESAR →</button>
    </div>
  )
}

// Mobile gets its own single-screen layout (photo strip + scrollable info +
// sticky CTA) instead of the desktop 3-column grid stacked as 3 full-height
// sections — that made buying/wishlist-ing on mobile require scrolling past
// two full viewports first.
function MobileProduct({ p, b, photos, soldOut, pid, isLiked, toggle, logoFailed, setLogoFailed }) {
  const [fullPhoto, setFullPhoto] = useState(null)
  return (
    <div style={{ height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: T.font, fontWeight: 700, color: T.ink, background: T.paper }}>
      <div style={{ position: 'relative', height: '44vh', minHeight: 300, flex: 'none', borderBottom: `1px solid ${T.hair}`, overflow: 'hidden' }}>
        <div style={{ display: 'flex', height: '100%', overflowX: 'auto', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
          {photos.map((src, i) => (
            <div key={i} onClick={() => setFullPhoto(i)} style={{ position: 'relative', width: '100%', height: '100%', flex: 'none', scrollSnapAlign: 'start', background: '#e8e8e6' }}>
              <img
                src={cdnResize(src, 760)}
                alt={`${p.name} ${i + 1}`}
                loading="lazy"
                decoding="async"
                draggable="false"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', userSelect: 'none' }}
              />
            </div>
          ))}
        </div>
        {photos.length > 1 && (
          <div style={{ position: 'absolute', bottom: 10, right: 12, fontSize: 9, fontWeight: 500, letterSpacing: 1, background: 'rgba(255,255,255,0.9)', padding: '3px 8px' }}>
            0{photos.length} FOTOS →
          </div>
        )}
      </div>

      {fullPhoto !== null && (
        <div
          onClick={() => setFullPhoto(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(10,10,10,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pac-fade-in 150ms ease-out' }}
        >
          <img
            src={cdnResize(photos[fullPhoto], 1400)}
            alt={`${p.name} ${fullPhoto + 1}`}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
          <button
            onClick={() => setFullPhoto(null)}
            aria-label="Cerrar"
            style={{ all: 'unset', cursor: 'pointer', position: 'absolute', top: 16, right: 16, width: 40, height: 40, border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(10,10,10,0.6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 }}
          >✕</button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 22px' }}>
        {b.logo && !logoFailed ? (
          <div style={{ display: 'flex', alignItems: 'center', height: 40, padding: b.logoDark ? '8px 14px' : 0, background: b.logoDark ? T.ink : 'transparent' }}>
            <img src={b.logo} alt={b.name} onError={() => setLogoFailed(true)} style={{ maxHeight: '100%', maxWidth: 160, objectFit: 'contain' }} />
          </div>
        ) : (
          <div style={{ fontSize: 22, letterSpacing: -0.4, fontWeight: 700, textTransform: 'uppercase' }}>{b.name}</div>
        )}

        <a href={b.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 8, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', textDecoration: 'underline', textUnderlineOffset: 4, color: 'inherit' }}>
          VER PERFIL DE LA MARCA →
        </a>

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${T.hair}` }}>
          <div style={{ fontSize: 30, letterSpacing: -0.6, lineHeight: 1.05, textTransform: 'uppercase' }}>{p.name}</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 10, letterSpacing: 0.3, color: soldOut ? T.ink2 : T.ink }}>
            {soldOut ? 'AGOTADO' : `${p.price} CLP`}
          </div>
        </div>
      </div>

      <div style={{ flex: 'none', borderTop: `1px solid ${T.hair}`, padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))', background: T.paper, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
          <button className="pac-cta" style={{ width: '100%', padding: '15px', background: T.ink, color: T.paper, border: `1px solid ${T.hair}`, fontFamily: T.font, fontWeight: 700, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', cursor: 'pointer' }}>
            {soldOut ? `VER EN ${b.store} ↗` : `COMPRAR EN ${b.store} ↗`}
          </button>
        </a>
        <button
          className="pac-wishlist"
          onClick={() => toggle(pid)}
          aria-pressed={isLiked}
          style={{ width: '100%', padding: '13px', background: isLiked ? T.ink : T.paper, color: isLiked ? T.paper : T.ink, border: `1px solid ${T.hairStrong}`, fontFamily: T.font, fontWeight: 700, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', cursor: 'pointer' }}>
          {isLiked ? '♥ EN WISHLIST' : '♡ WISHLIST'}
        </button>
      </div>
    </div>
  )
}

export default function Product({ product }) {
  const p = product || PRODUCTS[5]
  const b = BRANDS[p.brand]
  const photos = [p.img, p.img2].filter(Boolean)
  const soldOut = p.price === 'AGOTADO'
  const { liked, toggle } = useWishlist()
  const { user, signInWithGoogle } = useAuth()
  const pid = PRODUCTS.indexOf(p)
  const isLiked = liked.has(pid)
  const mobile = useIsMobile()

  const [loginHint, setLoginHint] = useState(false)
  const loginHintTimer = useRef(null)
  const requireAuth = useCallback((fn) => {
    if (user) { fn(); return }
    setLoginHint(true)
    clearTimeout(loginHintTimer.current)
    loginHintTimer.current = setTimeout(() => setLoginHint(false), 3500)
  }, [user])

  const scrollRef = useRef(null)
  const dragRef = useRef(null)
  const [revealed, setRevealed] = useState(() => new Set([0]))
  const [logoFailed, setLogoFailed] = useState(false)
  useEffect(() => { setLogoFailed(false) }, [p.brand])

  useEffect(() => {
    const root = scrollRef.current
    if (!root || typeof IntersectionObserver === 'undefined') return
    const els = root.querySelectorAll('[data-photo-idx]')
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          const i = +en.target.dataset.photoIdx
          setRevealed((cur) => (cur.has(i) ? cur : new Set(cur).add(i)))
        }
      })
    }, { root, threshold: 0.35 })
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [photos.length])

  const onDown = (e) => {
    dragRef.current = { y: e.clientY, top: scrollRef.current.scrollTop }
    scrollRef.current.style.cursor = 'grabbing'
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch (_) {}
  }
  const onMove = (e) => {
    if (!dragRef.current) return
    scrollRef.current.scrollTop = dragRef.current.top - (e.clientY - dragRef.current.y)
  }
  const onUp = () => {
    dragRef.current = null
    if (scrollRef.current) scrollRef.current.style.cursor = 'grab'
  }

  if (mobile) {
    return (
      <div style={{ position: 'relative' }}>
        <MobileProduct
          p={p} b={b} photos={photos} soldOut={soldOut} pid={pid}
          isLiked={isLiked} toggle={(id) => requireAuth(() => toggle(id))}
          logoFailed={logoFailed} setLogoFailed={setLogoFailed}
        />
        {loginHint && <LoginHint onLogin={signInWithGoogle} font={T.font} />}
      </div>
    )
  }

  return (
    <div className="pac-viewport pac-product-grid" style={{
      overflow: 'hidden',
      fontFamily: T.font,
      fontWeight: 700,
      color: T.ink,
      background: T.paper,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
    }}>
      {/* COL 1 — brand info */}
      <div className="pac-product-col" style={{
        borderRight: `1px solid ${T.hair}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 48px',
        textAlign: 'center',
        animation: 'pac-fade-up 420ms cubic-bezier(.22,.61,.36,1) 0ms backwards',
      }}>
        <div style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: 1.5,
          color: T.ink2,
          textTransform: 'uppercase',
          marginBottom: S.sm,
        }}>
          MARCA
        </div>

        {b.logo && !logoFailed ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 64,
            padding: b.logoDark ? '14px 22px' : 0,
            background: b.logoDark ? T.ink : 'transparent',
          }}>
            <img
              src={b.logo}
              alt={b.name}
              onError={() => setLogoFailed(true)}
              style={{ maxHeight: '100%', maxWidth: 220, objectFit: 'contain' }}
            />
          </div>
        ) : (
          <div className="pac-product-brand" style={{
            fontSize: 44,
            letterSpacing: -1,
            fontWeight: 700,
            textTransform: 'uppercase',
            lineHeight: 0.95,
          }}>
            {b.name}
          </div>
        )}

        <div style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: 1,
          color: T.ink2,
          textTransform: 'uppercase',
          marginTop: 10,
        }}>
          {b.meta}
        </div>

        <div style={{
          marginTop: S.lg,
          fontSize: 13,
          lineHeight: 1.4,
          letterSpacing: 0.2,
          textTransform: 'uppercase',
          maxWidth: 320,
        }}>
          {b.vision}
        </div>

        <div style={{
          marginTop: S.md,
          fontSize: 13,
          fontWeight: 500,
          lineHeight: 1.6,
          color: T.ink2,
          maxWidth: 340,
          letterSpacing: 0.3,
        }}>
          {b.history}
        </div>

        <div style={{
          marginTop: 26,
          fontSize: 10,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          textDecoration: 'underline',
          textUnderlineOffset: 4,
          cursor: 'pointer',
        }}>
          <a href={b.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'inherit' }}>
            VER PERFIL DE LA MARCA →
          </a>
        </div>
      </div>

      {/* COL 2 — vertical photo gallery, scroll/drag */}
      <div className="pac-product-col" style={{
        borderRight: `1px solid ${T.hair}`,
        position: 'relative',
        overflow: 'hidden',
        animation: 'pac-fade-up 420ms cubic-bezier(.22,.61,.36,1) 70ms backwards',
      }}>
        <div
          ref={scrollRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{
            height: '100%',
            overflowY: photos.length === 1 ? 'hidden' : 'auto',
            cursor: photos.length === 1 ? 'default' : 'grab',
            padding: S.lg,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            justifyContent: photos.length === 1 ? 'center' : 'flex-start',
          }}
        >
          {photos.map((src, i) => (
            <div
              key={i}
              data-photo-idx={i}
              className="pac-product-photo"
              style={{
                position: 'relative',
                width: '100%',
                height: 560,
                flex: 'none',
                background: '#e8e8e6',
                overflow: 'hidden',
                opacity: revealed.has(i) ? 1 : 0,
                transform: revealed.has(i) ? 'translateY(0) scale(1)' : 'translateY(18px) scale(0.985)',
                transition: 'opacity 480ms cubic-bezier(.22,.61,.36,1), transform 480ms cubic-bezier(.22,.61,.36,1)',
              }}
            >
              <img
                src={cdnResize(src, 960)}
                alt={`${p.name} ${i + 1}`}
                loading="lazy"
                decoding="async"
                draggable="false"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  userSelect: 'none',
                }}
              />
              <div style={{
                position: 'absolute',
                top: 10,
                left: 12,
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: 1,
                background: 'rgba(255,255,255,0.9)',
                padding: '3px 8px',
              }}>
                0{i + 1}/0{photos.length}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* COL 3 — purchase info */}
      <div className="pac-product-col" style={{
        padding: S.lg,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        animation: 'pac-fade-up 420ms cubic-bezier(.22,.61,.36,1) 140ms backwards',
      }}>
        <div className="pac-product-name" style={{
          fontSize: 34,
          letterSpacing: -0.5,
          lineHeight: 1,
          textTransform: 'uppercase',
        }}>
          {p.name}
        </div>

        <div style={{
          fontSize: 22,
          marginTop: 16,
          textTransform: 'uppercase',
          letterSpacing: 0,
          color: soldOut ? T.ink2 : T.ink,
        }}>
          {soldOut ? 'AGOTADO' : `${p.price} CLP`}
        </div>

        <a
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'none', marginTop: S.lg }}
        >
          <button className="pac-cta" style={{
            width: '100%',
            padding: '18px',
            background: T.ink,
            color: T.paper,
            border: `1px solid ${T.hair}`,
            fontFamily: T.font,
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: 2,
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}>
            {soldOut ? `VER EN ${b.store} ↗` : `COMPRAR EN ${b.store} ↗`}
          </button>
        </a>

        <button
          className="pac-wishlist"
          onClick={() => requireAuth(() => toggle(pid))}
          aria-pressed={isLiked}
          style={{
            width: '100%',
            marginTop: S.xs,
            padding: `${S.sm}px`,
            background: isLiked ? T.ink : T.paper,
            color: isLiked ? T.paper : T.ink,
            border: `1px solid ${T.hairStrong}`,
            fontFamily: T.font,
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: 2,
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}>
          {isLiked ? '♥ EN WISHLIST' : '♡ WISHLIST'}
        </button>
      </div>
      {loginHint && <LoginHint onLogin={signInWithGoogle} font={T.font} />}
    </div>
  )
}
