import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveStorageBucketName } from "../../firebase/admin.js";

const originalEnv = {};
const bucketEnvNames = [
  "PT_MEDIA_BUCKET",
  "FIREBASE_STORAGE_BUCKET",
  "FIREBASE_CONFIG",
  "VITE_FIREBASE_STORAGE_BUCKET",
];

describe("firebase/admin storage bucket resolution", () => {
  beforeEach(() => {
    for (const name of bucketEnvNames) {
      originalEnv[name] = process.env[name];
      delete process.env[name];
    }
  });

  afterEach(() => {
    for (const name of bucketEnvNames) {
      if (originalEnv[name] === undefined) delete process.env[name];
      else process.env[name] = originalEnv[name];
    }
  });

  it("usa storageBucket de FIREBASE_CONFIG quando env dedicado nao existe", () => {
    process.env.FIREBASE_CONFIG = JSON.stringify({
      projectId: "mw-personal-trainer",
      storageBucket: "mw-personal-trainer.firebasestorage.app",
    });

    expect(resolveStorageBucketName()).toBe("mw-personal-trainer.firebasestorage.app");
  });

  it("prioriza bucket explicito e normaliza gs://", () => {
    process.env.FIREBASE_CONFIG = JSON.stringify({
      storageBucket: "mw-personal-trainer.firebasestorage.app",
    });

    expect(resolveStorageBucketName("gs://custom-bucket/")).toBe("custom-bucket");
  });

  it("prioriza PT_MEDIA_BUCKET sobre FIREBASE_CONFIG", () => {
    process.env.PT_MEDIA_BUCKET = "pt-private-bucket";
    process.env.FIREBASE_CONFIG = JSON.stringify({
      storageBucket: "mw-personal-trainer.firebasestorage.app",
    });

    expect(resolveStorageBucketName()).toBe("pt-private-bucket");
  });
});
