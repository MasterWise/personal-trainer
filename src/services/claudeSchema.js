const PLAN_DATE_PATTERN = "^\\d{2}/\\d{2}/\\d{4}$";

function resolvePlanScopeDate(interactionMeta = {}) {
  if (interactionMeta?.conversationType !== "plan") return null;
  if (typeof interactionMeta?.planDate !== "string") return null;
  const trimmed = interactionMeta.planDate.trim();
  return /^\d{2}\/\d{2}\/\d{4}$/.test(trimmed) ? trimmed : null;
}

export function buildResponseSchemaForInteraction(interactionMeta = {}) {
  const planScopeDate = resolvePlanScopeDate(interactionMeta);
  const allowPlanReplaceAll = interactionMeta?.autoAction === "generate_plan" || interactionMeta?.autoAction === "new_plan";

  const updateProperties = {
    file: {
      type: "string",
      enum: ["micro", "memoria", "historico", "plano", "progresso", "calorias", "treinos"],
    },
    action: {
      type: "string",
      enum: [
        "append",
        "replace_all",
        "add_progresso",
        "append_item",
        "patch_item",
        "delete_item",
        "append_micro",
        "patch_micro",
        "update_calorias_day",
        "log_treino_day",
        "patch_coach_note",
        "append_coach_note",
      ],
    },
    content: { type: "string" },
    requiresPermission: { type: "boolean" },
    permissionMessage: { type: "string" },
    permissionType: { type: ["string", "null"] },
    permissionGroupId: { type: ["string", "null"] },
    permissionPrompt: {
      type: ["object", "null"],
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
  };
  const updateRequired = ["file", "action", "content", "requiresPermission", "permissionMessage"];

  const rootProperties = {
    reply: { type: "string" },
    updates: {
      type: "array",
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
    updateProperties.targetDate = { type: ["string", "null"], pattern: PLAN_DATE_PATTERN };
    rootProperties.planScopeDate = { type: ["string", "null"], pattern: PLAN_DATE_PATTERN };
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
