import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage as getAdminStorage } from "firebase-admin/storage";

let cachedApp;
let cachedFirestore;
const cachedBuckets = new Map();

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

export function getStorageBucket(bucketName = null) {
  const resolvedBucket = bucketName
    || process.env.PT_MEDIA_BUCKET
    || process.env.FIREBASE_STORAGE_BUCKET
    || process.env.VITE_FIREBASE_STORAGE_BUCKET
    || null;
  const cacheKey = resolvedBucket || "__default__";
  if (cachedBuckets.has(cacheKey)) return cachedBuckets.get(cacheKey);
  const bucket = getAdminStorage(getFirebaseApp()).bucket(resolvedBucket || undefined);
  cachedBuckets.set(cacheKey, bucket);
  return bucket;
}

export { FieldValue };
