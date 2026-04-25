import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore, FieldValue } from "firebase-admin/firestore";

let cachedApp;
let cachedFirestore;

export function getFirebaseApp() {
  if (cachedApp) return cachedApp;

  const existing = getApps()[0];
  cachedApp = existing || initializeApp({
    credential: applicationDefault(),
    projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID,
  });
  return cachedApp;
}

export function getAuth() {
  return getAdminAuth(getFirebaseApp());
}

export function getFirestore() {
  if (cachedFirestore) return cachedFirestore;
  cachedFirestore = getAdminFirestore(getFirebaseApp());
  cachedFirestore.settings({ ignoreUndefinedProperties: true });
  return cachedFirestore;
}

export { FieldValue };
