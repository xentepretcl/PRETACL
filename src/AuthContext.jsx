import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { firebaseEnabled, loadFirebase } from './firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(firebaseEnabled)

  useEffect(() => {
    if (!firebaseEnabled) return
    let unsub = () => {}
    let cancelled = false
    loadFirebase().then(({ auth, authMod }) => {
      if (cancelled) return
      unsub = authMod.onAuthStateChanged(auth, (u) => {
        setUser(u)
        setLoading(false)
      })
    })
    return () => { cancelled = true; unsub() }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!firebaseEnabled) return
    const { auth, authMod, googleProvider } = await loadFirebase()
    await authMod.signInWithPopup(auth, googleProvider)
  }, [])

  const signOutUser = useCallback(async () => {
    if (!firebaseEnabled) return
    const { auth, authMod } = await loadFirebase()
    await authMod.signOut(auth)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOutUser, firebaseEnabled }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
