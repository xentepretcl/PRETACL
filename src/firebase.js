// Firebase SDK is loaded lazily (dynamic import) so unconfigured deployments
// ship zero extra bytes. It only downloads once VITE_FIREBASE_* env vars are
// set and a caller actually awaits loadFirebase() (sign-in click, wishlist sync).
export const firebaseEnabled = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID
)

let cached = null

export function loadFirebase() {
  if (!firebaseEnabled) return Promise.resolve(null)
  if (cached) return cached

  cached = (async () => {
    const [{ initializeApp, getApps }, authMod, fsMod] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore'),
    ])
    const config = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    }
    const app = getApps().length ? getApps()[0] : initializeApp(config)
    const auth = authMod.getAuth(app)
    const db = fsMod.getFirestore(app)
    const googleProvider = new authMod.GoogleAuthProvider()
    return { auth, db, authMod, fsMod, googleProvider }
  })()

  return cached
}
