const PLAN_DATE_PATTERN = "^\\d{2}/\\d{2}/\\d{4}$";

function resolvePlanScopeDate(interactionMeta = {}) {
  if (interactionMeta?.conversationType !== "plan") return null;
  const raw = interactionMeta?.planDate;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;
  }
  // Fallback to today for plan conversations without explicit date
  return new Date().toLocaleDateString("pt-BR");
}

export function buildResponseSchemaForInteraction(interactionMeta = {}) {
  const planScopeDate = resolvePlanScopeDate(interactionMeta);
  const allowPlanReplaceAll = interactionMeta?.autoAction === "generate_plan" || interactionMeta?.autoAction === "new_plan";

  const updateProperties = {
    file: {
      type: "string",
      enum: ["micro", "memoria", "historico", "plano", "progresso", "medidas"],
    },
    action: {
      type: "string",
      enum: [
        "append",
        "replace_all",
        "add_progresso",
        "add_medida",
        "append_item",
        "patch_item",
        "delete_item",
        "append_micro",
        "patch_micro",
        "patch_coach_note",
        "append_coach_note",
      ],
    },
    content: { anyOf: [{ type: "string" }, { type: "object" }] },
    requiresPermission: { type: "boolean" },
    permissionMessage: { type: "string" },
    permissionType: { anyOf: [{ type: "string" }, { type: "null" }] },
    permissionGroupId: { anyOf: [{ type: "string" }, { type: "null" }] },
    permissionPrompt: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          properties: {
            title: { type: "string" },
            message: { type: "string" },
            approveLabel: { type: "string" },
            rejectLabel: { type: "string" },
            details: {
              type: "array",
              items: { type: "string" },
            },
            approvedFeedback: { type: "string" },
            rejectedFeedback: { type: "string" },
          },
          required: ["title", "message", "approveLabel", "rejectLabel", "details"],
          additionalProperties: false,
        },
      ],
    },
  };
  const updateRequired = ["file", "action", "content", "requiresPermission", "permissionMessage"];

  const rootProperties = {
    reply: { type: "string" },
    updates: {
      type: "array",
      maxItems: 30,
      items: {
        type: "object",
        properties: updateProperties,
        required: updateRequired,
        additionalProperties: false,
      },
    },
  };
  const rootRequired = ["reply", "updates"];

  if (planScopeDate) {
    // Reinforcement: in plan conversations, every update must declare
    // a single scoped date (the target date of the conversation).
    updateProperties.targetDate = { type: "string", enum: [planScopeDate] };
    updateRequired.push("targetDate");
    rootProperties.planScopeDate = { type: "string", enum: [planScopeDate] };
    rootRequired.push("planScopeDate");
  } else {
    updateProperties.targetDate = { anyOf: [{ type: "string", pattern: PLAN_DATE_PATTERN }, { type: "null" }] };
    rootProperties.planScopeDate = { anyOf: [{ type: "string", pattern: PLAN_DATE_PATTERN }, { type: "null" }] };
  }

  if (planScopeDate && !allowPlanReplaceAll) {
    rootProperties.updates.items.allOf = [
      {
        not: {
          type: "object",
          properties: {
            file: { const: "plano" },
            action: { const: "replace_all" },
          },
          required: ["file", "action"],
        },
      },
    ];
  }

  return {
    type: "object",
    properties: rootProperties,
    required: rootRequired,
    additionalProperties: false,
  };
}
