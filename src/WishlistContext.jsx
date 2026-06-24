import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { firebaseEnabled, loadFirebase } from './firebase'
import { useAuth } from './AuthContext'

const KEY = 'pretacl_wishlist_v1'
const WishlistContext = createContext(null)

function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch (_) {
    return new Set()
  }
}

function saveLocal(set) {
  try { localStorage.setItem(KEY, JSON.stringify([...set])) } catch (_) {}
}

export function WishlistProvider({ children }) {
  const { user } = useAuth()
  const [liked, setLiked] = useState(loadLocal)
  const uidRef = useRef(null)

  // Guest (or Firebase not configured yet): localStorage only, same behavior as before.
  // Signed in: Firestore doc `wishlists/{uid}` becomes the source of truth. On first
  // login (no doc yet) the guest's local likes are carried over into the new account.
  useEffect(() => {
    if (!firebaseEnabled) return
    const uid = user?.uid || null
    if (uid === uidRef.current) return
    uidRef.current = uid

    if (!uid) {
      setLiked(loadLocal())
      return
    }

    ;(async () => {
      const { db, fsMod } = await loadFirebase()
      const ref = fsMod.doc(db, 'wishlists', uid)
      const snap = await fsMod.getDoc(ref)
      if (snap.exists()) {
        setLiked(new Set(snap.data().liked || []))
      } else {
        const seed = loadLocal()
        await fsMod.setDoc(ref, { liked: [...seed] })
        setLiked(seed)
      }
    })()
  }, [user])

  const toggle = useCallback((id) => {
    setLiked((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      if (uidRef.current && firebaseEnabled) {
        loadFirebase().then(({ db, fsMod }) => {
          fsMod.setDoc(fsMod.doc(db, 'wishlists', uidRef.current), { liked: [...next] }).catch(() => {})
        })
      } else {
        saveLocal(next)
      }
      return next
    })
  }, [])

  return (
    <WishlistContext.Provider value={{ liked, toggle }}>
      {children}
    </WishlistContext.Provider>
  )
}

export function useWishlist() {
  const ctx = useContext(WishlistContext)
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider')
  return ctx
}
