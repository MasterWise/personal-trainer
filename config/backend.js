export function isFirebaseBackendEnabled() {
  return process.env.FIREBASE_BACKEND === "true"
    || process.env.BACKEND_MODE === "firebase";
}

export function getBackendMode() {
  return isFirebaseBackendEnabled() ? "firebase" : "sqlite";
}
