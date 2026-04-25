export function isFirebaseBackendEnabled() {
  return process.env.FIREBASE_BACKEND === "true";
}

export function getBackendMode() {
  return isFirebaseBackendEnabled() ? "firebase" : "sqlite";
}
