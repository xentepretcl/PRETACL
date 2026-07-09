import { useState, lazy, Suspense } from 'react'
import GlobeIntro from './components/GlobeIntro'
import { T } from './tokens'
import { PRODUCTS } from './data'
import { useWishlist } from './WishlistContext'
import { useAuth } from './AuthContext'

const Lookbook = lazy(() => import('./components/Lookbook'))
const Product = lazy(() => import('./components/Product'))

function CloseBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Cerrar"
      className="pac-closebtn"
      style={{
        position: 'absolute',
        top: 16,
        right: 18,
        zIndex: 40,
        width: 40,
        height: 40,
        border: `1px solid ${T.hairStrong}`,
        background: T.paper,
        cursor: 'pointer',
        fontSize: 16,
        fontFamily: T.font,
        fontWeight: 700,
        color: T.ink,
      }}
    >
      ✕
    </button>
  )
}

const EXIT_MS = 280

export default function App() {
  const [view, setView] = useState(null) // 'lookbook' | 'wishlist' | null
  const [viewClosing, setViewClosing] = useState(false)
  const [product, setProduct] = useState(null)
  const [productClosing, setProductClosing] = useState(false)
  const { liked } = useWishlist()
  const { user, firebaseEnabled, signOutUser } = useAuth()

  const handleTile = (p) => setProduct(p)

  const closeProduct = () => {
    setProductClosing(true)
    setTimeout(() => { setProduct(null); setProductClosing(false) }, EXIT_MS)
  }
  const closeView = () => {
    setProductClosing(false)
    setProduct(null)
    setViewClosing(true)
    setTimeout(() => { setView(null); setViewClosing(false) }, EXIT_MS)
  }

  return (
    <div className="pac-viewport" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Base layer: Globe intro + home */}
      <GlobeIntro
        onOpenLookbook={() => setView('lookbook')}
        onOpenWishlist={() => setView('wishlist')}
        paused={!!view || !!product}
      />

      {/* Overlay: Lookbook / Wishlist */}
      {view && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 20,
          background: T.paper,
          animation: viewClosing
            ? `pac-fade-out ${EXIT_MS}ms ease-in forwards`
            : 'pac-fade-in 320ms ease-out',
        }}>
          <CloseBtn onClick={closeView} />
          {view === 'wishlist' && firebaseEnabled && user && (
            <button
              onClick={signOutUser}
              className="pac-closebtn"
              style={{
                position: 'absolute',
                top: 16,
                left: 18,
                zIndex: 40,
                padding: '0 16px',
                height: 40,
                border: `1px solid ${T.hairStrong}`,
                background: T.paper,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: 'uppercase',
                fontFamily: T.font,
                color: T.ink,
              }}
            >
              CERRAR SESIÓN
            </button>
          )}
          <Suspense fallback={null}>
            {view === 'wishlist' ? (
              <Lookbook
                onProduct={handleTile}
                list={PRODUCTS.filter((_, i) => liked.has(i))}
                label="WISHLIST"
              />
            ) : (
              <Lookbook onProduct={handleTile} />
            )}
          </Suspense>
        </div>
      )}

      {/* Overlay: Product (above Lookbook) */}
      {product && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 30,
          background: T.paper,
          animation: productClosing
            ? `pac-fade-down ${EXIT_MS}ms cubic-bezier(.22,.61,.36,1) forwards`
            : 'pac-fade-up 320ms cubic-bezier(.22,.61,.36,1)',
        }}>
          <CloseBtn onClick={closeProduct} />
          <Suspense fallback={null}>
            <Product product={product} />
          </Suspense>
        </div>
      )}
    </div>
  )
}
