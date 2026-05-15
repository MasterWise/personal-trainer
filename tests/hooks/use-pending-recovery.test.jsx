// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/api.js", () => ({
  get: vi.fn(),
  post: vi.fn(),
}));

const applyUpdateBatchMock = vi.fn();
const docsMock = {
  plano: "{}",
  perfil: "{}",
  mem: "",
  micro: "",
  hist: "",
  progresso: "[]",
  cal: "",
  treinos: "{}",
  macro: "",
  medidas: "[]",
};

vi.mock("../../src/contexts/DocsContext.jsx", () => ({
  useDocs: () => ({ docs: docsMock, applyUpdateBatch: applyUpdateBatchMock }),
}));

vi.mock("../../src/contexts/ToastContext.jsx", () => ({
  useToast: () => ({ show: vi.fn() }),
}));

import { get, post } from "../../src/services/api.js";
import { usePendingRecovery } from "../../src/hooks/usePendingRecovery.js";

function buildRawResponse(updates, reply = "Pronto") {
  return {
    content: [{ type: "output_json", json: { reply, updates } }],
  };
}

function renderRecovery({ currentConvoId = "c1", currentConvoMeta = null, setMessages = vi.fn() } = {}) {
  return renderHook(() =>
    usePendingRecovery({
      isAuthenticated: true,
      docsReady: true,
      conversationReady: true,
      currentConvoId,
      currentConvoMeta,
      setMessages,
    })
  );
}

describe("usePendingRecovery — autoridade derivada do pending", () => {
  beforeEach(() => {
    applyUpdateBatchMock.mockReset();
    applyUpdateBatchMock.mockResolvedValue([]);
    get.mockReset();
    post.mockReset();
    post.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("aplica replace_all do plano quando o pending traz auto_action=new_plan + conversation_type=plan + plan_date", async () => {
    const planJson = JSON.stringify({
      date: "13/05/2026",
      meta: { kcal_total: 2000 },
      grupos: [{ nome: "Cafe", itens: [{ id: "i1", texto: "Banana" }] }],
      notaCoach: "Foco total hoje",
    });
    const planUpdate = {
      file: "plano",
      action: "replace_all",
      targetDate: "13/05/2026",
      content: planJson,
    };
    const rawResponse = buildRawResponse([planUpdate]);

    get
      .mockResolvedValueOnce({
        items: [
          {
            id: "abc",
            status: "pending",
            conversation_id: "c1",
            created_at: "2026-05-13T20:09:09Z",
          },
        ],
      })
      .mockResolvedValueOnce({
        response_raw: JSON.stringify(rawResponse),
        conversation_type: "plan",
        plan_date: "13/05/2026",
        auto_action: "new_plan",
      });

    renderRecovery();

    await waitFor(() => expect(applyUpdateBatchMock).toHaveBeenCalled());
    const passedUpdates = applyUpdateBatchMock.mock.calls[0][0];
    expect(passedUpdates).toHaveLength(1);
    expect(passedUpdates[0]).toMatchObject({ file: "plano", action: "replace_all", targetDate: "13/05/2026" });
  });

  it("rejeita replace_all em conversa de plano sem auto_action (defensive default mantido)", async () => {
    const planJson = JSON.stringify({
      date: "14/05/2026",
      meta: { kcal_total: 2000 },
      grupos: [{ nome: "Cafe", itens: [] }],
    });
    const planUpdate = {
      file: "plano",
      action: "replace_all",
      targetDate: "14/05/2026",
      content: planJson,
    };
    const rawResponse = buildRawResponse([planUpdate]);

    get
      .mockResolvedValueOnce({
        items: [
          {
            id: "def",
            status: "pending",
            conversation_id: "c1",
            created_at: "2026-05-14T10:00:00Z",
          },
        ],
      })
      .mockResolvedValueOnce({
        response_raw: JSON.stringify(rawResponse),
        conversation_type: "plan",
        plan_date: "14/05/2026",
        auto_action: null,
      });

    renderRecovery();

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(applyUpdateBatchMock).not.toHaveBeenCalled();
  });

  it("ignora currentConvoMeta desatualizado e usa metadados do pending", async () => {
    const planJson = JSON.stringify({
      date: "15/05/2026",
      meta: { kcal_total: 1800 },
      grupos: [{ nome: "Cafe", itens: [{ id: "i9", texto: "Aveia" }] }],
    });
    const planUpdate = {
      file: "plano",
      action: "replace_all",
      targetDate: "15/05/2026",
      content: planJson,
    };
    const rawResponse = buildRawResponse([planUpdate]);

    get
      .mockResolvedValueOnce({
        items: [
          {
            id: "ghi",
            status: "pending",
            conversation_id: "c-was-plan",
            created_at: "2026-05-15T08:00:00Z",
          },
        ],
      })
      .mockResolvedValueOnce({
        response_raw: JSON.stringify(rawResponse),
        conversation_type: "plan",
        plan_date: "15/05/2026",
        auto_action: "generate_plan",
      });

    renderRecovery({
      currentConvoId: "c-other-general",
      currentConvoMeta: { type: "general", planDate: null },
    });

    await waitFor(() => expect(applyUpdateBatchMock).toHaveBeenCalled());
    const passedUpdates = applyUpdateBatchMock.mock.calls[0][0];
    expect(passedUpdates).toHaveLength(1);
    expect(passedUpdates[0].targetDate).toBe("15/05/2026");
  });

  it("aceita atualizacoes nao-plano (memoria/append) independentemente de auto_action", async () => {
    const memUpdate = { file: "memoria", action: "append", content: "linha nova de memoria" };
    const rawResponse = buildRawResponse([memUpdate]);

    get
      .mockResolvedValueOnce({
        items: [
          {
            id: "jkl",
            status: "pending",
            conversation_id: "c1",
            created_at: "2026-05-13T20:09:09Z",
          },
        ],
      })
      .mockResolvedValueOnce({
        response_raw: JSON.stringify(rawResponse),
        conversation_type: null,
        plan_date: null,
        auto_action: null,
      });

    renderRecovery();

    await waitFor(() => expect(applyUpdateBatchMock).toHaveBeenCalled());
    const passedUpdates = applyUpdateBatchMock.mock.calls[0][0];
    expect(passedUpdates).toHaveLength(1);
    expect(passedUpdates[0]).toMatchObject({ file: "memoria", action: "append" });
  });
});
