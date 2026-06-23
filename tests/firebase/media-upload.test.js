import { beforeEach, describe, expect, it, vi } from "vitest";

const expiredMediaDelete = vi.fn();
const uploadedMediaSave = vi.fn();
const uploadedMediaDelete = vi.fn();
const expiredMediaSet = vi.fn();
const uploadedMediaSet = vi.fn();
const uploadsQueryGet = vi.fn();
const uploadsCollectionDoc = vi.fn();

vi.mock("../../firebase/admin.js", () => ({
  FieldValue: {
    delete: () => ({ __fieldValue: "delete" }),
  },
  getFirestore: () => ({
    collection: () => ({
      doc: () => ({
        collection: () => uploadsCollection,
      }),
    }),
  }),
  getStorageBucket: (bucketName = null) => ({
    name: bucketName || "test-media-bucket",
    file: (objectName) => {
      if (objectName === "pt-media/old.png") {
        return { delete: expiredMediaDelete };
      }
      return { save: uploadedMediaSave, delete: uploadedMediaDelete };
    },
  }),
}));

const uploadsQuery = {
  limit: vi.fn(() => uploadsQuery),
  get: uploadsQueryGet,
};

const uploadsCollection = {
  where: vi.fn(() => uploadsQuery),
  doc: uploadsCollectionDoc,
};

function pngDataUrl() {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return `data:image/png;base64,${signature.toString("base64")}`;
}

describe("firebase/media upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    expiredMediaDelete.mockResolvedValue(undefined);
    uploadedMediaSave.mockResolvedValue(undefined);
    uploadedMediaDelete.mockResolvedValue(undefined);
    expiredMediaSet.mockResolvedValue(undefined);
    uploadedMediaSet.mockResolvedValue(undefined);
    uploadsCollectionDoc.mockReturnValue({ set: uploadedMediaSet });
    uploadsQueryGet
      .mockResolvedValueOnce({
        docs: [{
          id: "expired",
          data: () => ({
            bucket: "test-media-bucket",
            objectName: "pt-media/old.png",
            status: "available",
            expiresAt: new Date(Date.now() - 1000).toISOString(),
          }),
          ref: { set: expiredMediaSet },
        }],
      })
      .mockResolvedValueOnce({ docs: [] });
  });

  it("limpa anexos expirados antes de criar um novo upload", async () => {
    const { uploadMediaForUser } = await import("../../firebase/media.js");

    const media = await uploadMediaForUser("user-1", {
      kind: "image",
      mimeType: "image/png",
      dataUrl: pngDataUrl(),
      width: 32,
      height: 32,
    });

    expect(media.kind).toBe("image");
    expect(media.mimeType).toBe("image/png");
    expect(expiredMediaDelete).toHaveBeenCalledWith({ ignoreNotFound: true });
    expect(expiredMediaSet).toHaveBeenCalledWith(expect.objectContaining({
      status: "expired",
      deleteReason: "expired_before_upload",
    }), { merge: true });
    expect(uploadedMediaSave).toHaveBeenCalledOnce();
    expect(uploadedMediaSet).toHaveBeenCalledWith(expect.objectContaining({
      kind: "image",
      status: "available",
    }));
  });
});
