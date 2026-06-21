import { useState, lazy, Suspense } from 'react'
import Globe from './components/Globe'
import { T } from './tokens'

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
  const [lookbookOpen, setLookbookOpen] = useState(false)
  const [lookbookClosing, setLookbookClosing] = useState(false)
  const [product, setProduct] = useState(null)
  const [productClosing, setProductClosing] = useState(false)

  const handleTile = (p) => setProduct(p)

  const closeProduct = () => {
    setProductClosing(true)
    setTimeout(() => { setProduct(null); setProductClosing(false) }, EXIT_MS)
  }
  const closeLookbook = () => {
    setProductClosing(false)
    setProduct(null)
    setLookbookClosing(true)
    setTimeout(() => { setLookbookOpen(false); setLookbookClosing(false) }, EXIT_MS)
  }

  return (
    <div className="pac-viewport" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Base layer: Globe home */}
      <Globe onOpenLookbook={() => setLookbookOpen(true)} paused={lookbookOpen || !!product} />

      {/* Overlay: Lookbook */}
      {lookbookOpen && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 20,
          background: T.paper,
          animation: lookbookClosing
            ? `pac-fade-out ${EXIT_MS}ms ease-in forwards`
            : 'pac-fade-in 320ms ease-out',
        }}>
          <CloseBtn onClick={closeLookbook} />
          <Suspense fallback={null}>
            <Lookbook onProduct={handleTile} />
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
