// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
}));

vi.mock("../../src/contexts/AuthContext.jsx", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock("../../src/services/api.js", () => ({
  get: mocks.get,
  put: mocks.put,
  post: mocks.post,
}));

import { DocsProvider, useDocs } from "../../src/contexts/DocsContext.jsx";

let docsApi;

function Harness() {
  docsApi = useDocs();
  return <div data-testid="docs-ready">{String(docsApi.docsReady)}</div>;
}

afterEach(() => {
  cleanup();
  docsApi = null;
});

beforeEach(() => {
  mocks.get.mockReset();
  mocks.put.mockReset();
  mocks.post.mockReset();
  mocks.put.mockResolvedValue({ ok: true });
  mocks.post.mockResolvedValue({ ok: true });
});

describe("DocsProvider", () => {
  it("carrega os documentos iniciais e marca docsReady", async () => {
    mocks.get.mockResolvedValueOnce({
      documents: {
        micro: "perfil sintetico",
        plano: "{}",
      },
    });

    render(
      <DocsProvider>
        <Harness />
      </DocsProvider>
    );

    await waitFor(() => expect(docsApi?.docsReady).toBe(true));

    expect(docsApi.docs.micro).toBe("perfil sintetico");
    expect(docsApi.docs.plano).toBe("{}");
    expect(docsApi.docs.macro).toBe("");
  });

  it("aplica replace_all em plano por data e preserva ownership da IA", async () => {
    mocks.get.mockResolvedValueOnce({
      documents: {
        plano: "{}",
      },
    });

    render(
      <DocsProvider>
        <Harness />
      </DocsProvider>
    );

    await waitFor(() => expect(docsApi?.docsReady).toBe(true));

    let revision;
    await act(async () => {
      revision = await docsApi.applyUpdate({
        file: "plano",
        action: "replace_all",
        targetDate: "12/04/2026",
        content: {
          date: "12/04/2026",
          grupos: [
            {
              nome: "Manha",
              itens: [
                { id: "i1", tipo: "outro", texto: "Beber agua", checked: true },
              ],
            },
          ],
        },
      });
    });

    expect(revision).toMatchObject({ file: "plano", action: "replace_all", before: "{}" });
    expect(mocks.put).toHaveBeenCalledWith("/documents/plano", {
      content: expect.any(String),
    });

    const saved = JSON.parse(mocks.put.mock.calls[0][1].content);
    expect(saved["12/04/2026"].grupos[0].itens[0]).toMatchObject({
      id: "i1",
      checked: true,
      checked_source: "ai",
    });
    expect(docsApi.docs.plano).toBe(mocks.put.mock.calls[0][1].content);
  });

  it("append_coach_note agrega a nota do dia sem sobrescrever o restante", async () => {
    mocks.get.mockResolvedValueOnce({
      documents: {
        plano: JSON.stringify({
          "12/04/2026": {
            date: "12/04/2026",
            notaCoach: "Base",
            grupos: [],
          },
        }),
      },
    });

    render(
      <DocsProvider>
        <Harness />
      </DocsProvider>
    );

    await waitFor(() => expect(docsApi?.docsReady).toBe(true));

    await act(async () => {
      await docsApi.applyUpdate({
        file: "plano",
        action: "append_coach_note",
        targetDate: "12/04/2026",
        content: { nota: "Novo trecho" },
      });
    });

    const saved = JSON.parse(docsApi.docs.plano);
    expect(saved["12/04/2026"].notaCoach).toBe("Base\nNovo trecho");
    expect(saved["12/04/2026"].grupos).toEqual([]);
  });

  it("clearDocs e restoreDocs recarregam o estado persistido", async () => {
    mocks.get
      .mockResolvedValueOnce({ documents: { micro: "original" } })
      .mockResolvedValueOnce({ documents: {} })
      .mockResolvedValueOnce({ documents: { micro: "restaurado", plano: "{}" } });

    render(
      <DocsProvider>
        <Harness />
      </DocsProvider>
    );

    await waitFor(() => expect(docsApi?.docsReady).toBe(true));
    expect(docsApi.docs.micro).toBe("original");

    await act(async () => {
      await docsApi.clearDocs();
    });
    expect(mocks.post).toHaveBeenCalledWith("/documents/reset");
    expect(docsApi.docs.micro).toBe("");

    await act(async () => {
      await docsApi.restoreDocs();
    });
    expect(mocks.post).toHaveBeenCalledWith("/documents/restore");
    expect(docsApi.docs.micro).toBe("restaurado");
    expect(docsApi.docs.plano).toBe("{}");
  });
});
