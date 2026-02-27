import { describe, expect, it } from "vitest";
import { groupRevisionsByType } from "../../src/utils/groupRevisions.js";

describe("group revisions", () => {
  it("agrupa por file preservando ordem de primeira ocorrência", () => {
    const revisions = [
      { file: "plano", action: "patch_item", before: "a", after: "b" },
      { file: "plano", action: "patch_item", before: "b", after: "c" },
      { file: "calorias", action: "update_calorias_day", before: "x", after: "y" },
      { file: "plano", action: "append_item", before: "m", after: "n" },
      { file: "calorias", action: "update_calorias_day", before: "y", after: "z" },
    ];

    const grouped = groupRevisionsByType(revisions);

    expect(grouped).toHaveLength(2);
    expect(grouped[0].key).toBe("plano");
    expect(grouped[0].indexes).toEqual([0, 1, 3]);
    expect(grouped[1].key).toBe("calorias");
    expect(grouped[1].indexes).toEqual([2, 4]);
  });
});
