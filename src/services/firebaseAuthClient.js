const FIREBASE_SDK_VERSION = "10.14.1";
const FIREBASE_APP_SDK_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`;
const FIREBASE_AUTH_SDK_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
};

export const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

let authClientPromise = null;

async function loadAuthClient() {
  if (!hasFirebaseConfig) return null;
  if (!authClientPromise) {
    authClientPromise = Promise.all([
      import(/* @vite-ignore */ FIREBASE_APP_SDK_URL),
      import(/* @vite-ignore */ FIREBASE_AUTH_SDK_URL),
    ]).then(async ([appSdk, authSdk]) => {
      const existingApp = appSdk.getApps().find((app) => app.name === "[DEFAULT]");
      const app = existingApp || appSdk.initializeApp(firebaseConfig);
      const auth = authSdk.getAuth(app);
      // Force LOCAL persistence (IndexedDB / localStorage) so the user stays
      // logged in across tab closes and browser restarts. The Firebase default
      // is already LOCAL, but in some popup/iframe scenarios it silently falls
      // back to SESSION; setting it explicitly avoids that surprise.
      try {
        await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);
      } catch (error) {
        console.warn("[firebaseAuth] setPersistence(LOCAL) failed:", error?.message);
      }
      return { auth, authSdk };
    });
  }
  return authClientPromise;
}

export async function getFirebaseIdToken(forceRefresh = false) {
  const client = await loadAuthClient();
  const user = client?.auth?.currentUser;
  return user ? user.getIdToken(forceRefresh) : null;
}

export async function loginWithFirebaseEmail(email, password) {
  const client = await loadAuthClient();
  if (!client) throw new Error("Firebase Auth nao configurado");
  const credential = await client.authSdk.signInWithEmailAndPassword(client.auth, email, password);
  return credential.user;
}

export async function registerWithFirebaseEmail(email, password) {
  const client = await loadAuthClient();
  if (!client) throw new Error("Firebase Auth nao configurado");
  const credential = await client.authSdk.createUserWithEmailAndPassword(client.auth, email, password);
  return credential.user;
}

export async function loginWithFirebaseGoogle() {
  const client = await loadAuthClient();
  if (!client) throw new Error("Firebase Auth nao configurado");
  const provider = new client.authSdk.GoogleAuthProvider();
  const credential = await client.authSdk.signInWithPopup(client.auth, provider);
  return credential.user;
}

export async function logoutFirebase() {
  const client = await loadAuthClient();
  if (client) await client.authSdk.signOut(client.auth);
}

export async function onFirebaseAuthChanged(callback) {
  const client = await loadAuthClient();
  if (!client) return () => {};
  return client.authSdk.onAuthStateChanged(client.auth, callback);
}

export function mapFirebaseUser(user, backendUser = null) {
  if (backendUser) return backendUser;
  if (!user) return null;
  return {
    id: user.uid,
    uid: user.uid,
    name: user.displayName || user.email || "Usuario",
    email: user.email || null,
    isAdmin: false,
    provider: "firebase",
  };
}
