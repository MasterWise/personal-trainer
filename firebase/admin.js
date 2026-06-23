import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage as getAdminStorage } from "firebase-admin/storage";

let cachedApp;
let cachedFirestore;
const cachedBuckets = new Map();

function normalizeBucketName(value) {
  const bucket = String(value || "").trim();
  if (!bucket) return null;
  return bucket.replace(/^gs:\/\//i, "").replace(/\/+$/, "");
}

function readFirebaseConfig() {
  const raw = process.env.FIREBASE_CONFIG;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function resolveStorageBucketName(bucketName = null) {
  const firebaseConfig = readFirebaseConfig();
  return normalizeBucketName(bucketName)
    || normalizeBucketName(process.env.PT_MEDIA_BUCKET)
    || normalizeBucketName(process.env.FIREBASE_STORAGE_BUCKET)
    || normalizeBucketName(firebaseConfig.storageBucket)
    || normalizeBucketName(process.env.VITE_FIREBASE_STORAGE_BUCKET);
}

export function getFirebaseApp() {
  if (cachedApp) return cachedApp;

  const existing = getApps()[0];
  const storageBucket = resolveStorageBucketName();
  cachedApp = existing || initializeApp({
    credential: applicationDefault(),
    projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID,
    ...(storageBucket ? { storageBucket } : {}),
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
  const resolvedBucket = resolveStorageBucketName(bucketName);
  const cacheKey = resolvedBucket || "__default__";
  if (cachedBuckets.has(cacheKey)) return cachedBuckets.get(cacheKey);
  const bucket = getAdminStorage(getFirebaseApp()).bucket(resolvedBucket || undefined);
  cachedBuckets.set(cacheKey, bucket);
  return bucket;
}

export { FieldValue };
