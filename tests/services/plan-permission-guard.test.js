import { describe, expect, it } from "vitest";
import { enforcePlanUserCheckedPermission } from "../../src/utils/planPermissionGuard.js";

function buildPlano() {
  return JSON.stringify({
    "27/02/2026": {
      date: "27/02/2026",
      grupos: [
        {
          nome: "Almoço",
          itens: [
            { id: "a1", texto: "Frango", checked: true, checked_source: "user" },
            { id: "a2", texto: "Batata", checked: true, checked_source: "ai" },
            { id: "a3", texto: "Salada", checked: false },
          ],
        },
      ],
    },
  });
}

describe("plan permission guard", () => {
  it("força permissão quando patch_item tenta alterar item marcado pelo usuário", () => {
    const update = {
      file: "plano",
      action: "patch_item",
      targetDate: "27/02/2026",
      content: JSON.stringify({
        date: "27/02/2026",
        id: "a1",
        patch: { checked: false },
      }),
      requiresPermission: false,
      permissionMessage: "",
    };

    const guarded = enforcePlanUserCheckedPermission(update, buildPlano());
    expect(guarded.requiresPermission).toBe(true);
    expect(guarded.update.requiresPermission).toBe(true);
    expect(guarded.update.permissionType).toBe("plan_checked_item_mutation");
    expect(guarded.info.reason).toBe("locked_user_checked_item");
  });

  it("não exige permissão para item marcado pela IA", () => {
    const update = {
      file: "plano",
      action: "patch_item",
      targetDate: "27/02/2026",
      content: JSON.stringify({
        date: "27/02/2026",
        id: "a2",
        patch: { checked: false },
      }),
      requiresPermission: false,
      permissionMessage: "",
    };

    const guarded = enforcePlanUserCheckedPermission(update, buildPlano());
    expect(guarded.requiresPermission).toBe(false);
    expect(guarded.update.requiresPermission).toBe(false);
  });

  it("não exige permissão para item não marcado", () => {
    const update = {
      file: "plano",
      action: "delete_item",
      targetDate: "27/02/2026",
      content: JSON.stringify({
        date: "27/02/2026",
        id: "a3",
      }),
      requiresPermission: false,
      permissionMessage: "",
    };

    const guarded = enforcePlanUserCheckedPermission(update, buildPlano());
    expect(guarded.requiresPermission).toBe(false);
  });
});
