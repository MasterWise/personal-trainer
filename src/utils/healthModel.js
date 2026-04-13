const DEFAULT_META = {
  kcal: 1450,
  proteina_g: 115,
  carbo_g: 110,
  gordura_g: 45,
  fibra_g: 25,
};

const EMPTY_DAY = {
  kcal_consumido: 0,
  proteina_g: 0,
  carbo_g: 0,
  gordura_g: 0,
  fibra_g: 0,
  refeicoes: [],
};

export function parseDateBR(str) {
  if (!str) return new Date();
  const [d, m, y] = String(str).split("/").map(Number);
  if (!d || !m || !y) return new Date();
  return new Date(y, m - 1, d);
}

export function toDateBR(date) {
  return date.toLocaleDateString("pt-BR");
}

export function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseJsonObject(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "object") return value || fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function parseJsonArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parsePlanoDict(planoStr, fallbackDate = null) {
  const parsed = parseJsonObject(planoStr, {});
  if (Array.isArray(parsed)) return {};
  if (parsed.grupos) {
    const dateKey = parsed.date || fallbackDate || toDateBR(new Date());
    return { [dateKey]: parsed };
  }
  return parsed;
}

export function getPlanDay(planoStr, selectedDate) {
  const dict = parsePlanoDict(planoStr, selectedDate);
  return dict[selectedDate] || null;
}

export function getAllPlanItems(planDay) {
  if (!planDay?.grupos) return [];
  const items = [];
  for (const group of planDay.grupos) {
    for (const item of group.itens || []) {
      items.push(item);
    }
  }
  return items;
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeMeta(meta, profile = {}) {
  if (meta && typeof meta === "object") {
    return {
      kcal: normalizeNumber(meta.kcal, DEFAULT_META.kcal),
      proteina_g: normalizeNumber(meta.proteina_g, DEFAULT_META.proteina_g),
      carbo_g: normalizeNumber(meta.carbo_g, DEFAULT_META.carbo_g),
      gordura_g: normalizeNumber(meta.gordura_g, DEFAULT_META.gordura_g),
      fibra_g: normalizeNumber(meta.fibra_g, DEFAULT_META.fibra_g),
    };
  }

  const macros = profile?.macros_alvo || {};
  return {
    kcal: normalizeNumber(macros.kcal, DEFAULT_META.kcal),
    proteina_g: normalizeNumber(macros.proteina_g, DEFAULT_META.proteina_g),
    carbo_g: normalizeNumber(macros.carbo_g, DEFAULT_META.carbo_g),
    gordura_g: normalizeNumber(macros.gordura_g, DEFAULT_META.gordura_g),
    fibra_g: normalizeNumber(macros.fibras_g, DEFAULT_META.fibra_g),
  };
}

function sumNutrition(items) {
  const totals = {
    kcal_consumido: 0,
    proteina_g: 0,
    carbo_g: 0,
    gordura_g: 0,
    fibra_g: 0,
    refeicoes: [],
  };

  for (const item of items) {
    if (!item?.checked || item.tipo !== "alimento" || !item.nutri) continue;
    totals.kcal_consumido += normalizeNumber(item.nutri.kcal);
    totals.proteina_g += normalizeNumber(item.nutri.proteina_g);
    totals.carbo_g += normalizeNumber(item.nutri.carbo_g);
    totals.gordura_g += normalizeNumber(item.nutri.gordura_g);
    totals.fibra_g += normalizeNumber(item.nutri.fibra_g);
    totals.refeicoes.push({
      id: item.id || `${item.texto || "item"}-${totals.refeicoes.length}`,
      text: `${item.texto} (${normalizeNumber(item.nutri.kcal)}kcal)`,
      itemId: item.id || null,
    });
  }

  totals.kcal_consumido = Math.round(totals.kcal_consumido);
  totals.proteina_g = +totals.proteina_g.toFixed(1);
  totals.carbo_g = +totals.carbo_g.toFixed(1);
  totals.gordura_g = +totals.gordura_g.toFixed(1);
  totals.fibra_g = +totals.fibra_g.toFixed(1);
  return totals;
}

function buildFallbackDayData(rawDay) {
  if (!rawDay || typeof rawDay !== "object") return { ...EMPTY_DAY };
  const refeicoes = Array.isArray(rawDay.refeicoes)
    ? rawDay.refeicoes.map((entry, index) => {
        if (entry && typeof entry === "object") {
          return {
            id: entry.id || `legacy-${index}`,
            text: String(entry.text || entry.label || ""),
            itemId: entry.itemId || null,
          };
        }
        return {
          id: `legacy-${index}`,
          text: String(entry),
          itemId: null,
        };
      }).filter((entry) => entry.text)
    : [];

  return {
    kcal_consumido: normalizeNumber(rawDay.kcal_consumido),
    proteina_g: normalizeNumber(rawDay.proteina_g),
    carbo_g: normalizeNumber(rawDay.carbo_g),
    gordura_g: normalizeNumber(rawDay.gordura_g),
    fibra_g: normalizeNumber(rawDay.fibra_g),
    refeicoes,
  };
}

function buildWorkoutLogIndex(treinosStr) {
  const treinos = parseJsonObject(treinosStr, {});
  const logs = Array.isArray(treinos.registros) ? treinos.registros : [];
  const byDate = {};

  for (const entry of logs) {
    const date = typeof entry?.data === "string" ? entry.data : null;
    if (!date) continue;
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(entry);
  }

  return { treinos, byDate };
}

function buildPlannedWorkouts(perfilStr, treinosStr) {
  const profile = parseJsonObject(perfilStr, {});
  const profileEntries = Array.isArray(profile.treinos_planejados) ? profile.treinos_planejados : [];
  const { treinos } = buildWorkoutLogIndex(treinosStr);
  const planned = {};

  for (const entry of profileEntries) {
    if (!entry?.dia) continue;
    if (!planned[entry.dia]) planned[entry.dia] = [];
    planned[entry.dia].push({
      tipo: String(entry.tipo || "Treino"),
      duracao: String(entry.duracao || ""),
      horario: String(entry.horario || ""),
      label: [entry.tipo, entry.duracao, entry.horario].filter(Boolean).join(" · ") || "Treino planejado",
    });
  }

  if (Object.keys(planned).length === 0 && treinos?.planejados && typeof treinos.planejados === "object") {
    for (const [dayKey, label] of Object.entries(treinos.planejados)) {
      planned[dayKey] = [{ tipo: String(label || "Treino"), duracao: "", horario: "", label: String(label || "Treino planejado") }];
    }
  }

  return planned;
}

function buildDayWorkoutState(planDay, logsForDay = []) {
  const workoutItems = getAllPlanItems(planDay).filter((item) => item.tipo === "treino");
  const completedPlanItems = workoutItems.filter((item) => item.checked);
  const complementaryLogs = logsForDay
    .filter((entry) => !completedPlanItems.some((item) => (item.id && entry.item_id && entry.item_id === item.id)))
    .map((entry, index) => ({
      id: entry.item_id || `log-${index}`,
      tipo: String(entry.tipo || "Treino"),
      duracao_min: normalizeNumber(entry.duracao_min, 0),
      realizado: entry.realizado !== false,
      notas: String(entry.notas || ""),
    }));

  return {
    completedPlanItems: completedPlanItems.map((item) => ({
      id: item.id || item.texto,
      tipo: String(item.treino_tipo || item.texto || "Treino"),
      duracao_min: normalizeNumber(item.duracao_min, 60),
      realizado: true,
      notas: "",
    })),
    complementaryLogs,
  };
}

function buildDayProjection({ planDay, meta, fallbackCalDay, logsForDay }) {
  const canonicalNutrition = planDay ? sumNutrition(getAllPlanItems(planDay)) : null;
  const hasCanonicalNutrition = !!canonicalNutrition && (
    canonicalNutrition.kcal_consumido > 0 ||
    canonicalNutrition.proteina_g > 0 ||
    canonicalNutrition.carbo_g > 0 ||
    canonicalNutrition.gordura_g > 0 ||
    canonicalNutrition.fibra_g > 0 ||
    canonicalNutrition.refeicoes.length > 0
  );

  const fallbackNutrition = buildFallbackDayData(fallbackCalDay);
  const dayData = hasCanonicalNutrition ? canonicalNutrition : fallbackNutrition;
  const workoutState = buildDayWorkoutState(planDay, logsForDay);

  return {
    meta,
    dayData,
    completedPlanItems: workoutState.completedPlanItems,
    complementaryLogs: workoutState.complementaryLogs,
  };
}

export function deriveHealthViewModel({ planoStr, perfilStr, treinosStr, calStr, selectedDate }) {
  const realToday = toDateBR(new Date());
  const planDict = parsePlanoDict(planoStr, selectedDate);
  const profile = parseJsonObject(perfilStr, {});
  const plannedWorkouts = buildPlannedWorkouts(perfilStr, treinosStr);
  const { byDate: logsByDate } = buildWorkoutLogIndex(treinosStr);
  const calObj = parseJsonObject(calStr, {});
  const selectedPlanDay = planDict[selectedDate] || null;
  const meta = normalizeMeta(selectedPlanDay?.meta, profile);

  const selectedProjection = buildDayProjection({
    planDay: selectedPlanDay,
    meta,
    fallbackCalDay: calObj.dias?.[selectedDate],
    logsForDay: logsByDate[selectedDate] || [],
  });

  const selectedJS = parseDateBR(selectedDate);
  const startOfWeek = getMonday(selectedJS);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    const dateStr = toDateBR(date);
    const dayKey = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"][date.getDay()];
    const dayPlan = planDict[dateStr] || null;
    const dayMeta = normalizeMeta(dayPlan?.meta, profile);
    const dayProjection = buildDayProjection({
      planDay: dayPlan,
      meta: dayMeta,
      fallbackCalDay: calObj.dias?.[dateStr],
      logsForDay: logsByDate[dateStr] || [],
    });

    const completedWorkoutCount = dayProjection.completedPlanItems.length
      + dayProjection.complementaryLogs.filter((entry) => entry.realizado).length;
    const missedWorkoutCount = dayProjection.complementaryLogs.filter((entry) => entry.realizado === false).length;
    const plannedForDay = plannedWorkouts[dayKey] || [];

    return {
      dateStr,
      dayKey,
      dayNum: date.getDate(),
      jsDay: date.getDay(),
      isToday: dateStr === realToday,
      isSelected: dateStr === selectedDate,
      plannedWorkouts: plannedForDay,
      completedPlanItems: dayProjection.completedPlanItems,
      complementaryLogs: dayProjection.complementaryLogs,
      completedWorkoutCount,
      missedWorkoutCount,
      dayData: dayProjection.dayData,
      isPlanned: plannedForDay.length > 0,
      hasWorkoutInfo: plannedForDay.length > 0 || completedWorkoutCount > 0 || missedWorkoutCount > 0,
    };
  });

  const weekKcal = weekDays.reduce((sum, day) => sum + normalizeNumber(day.dayData.kcal_consumido), 0);
  const metaSemana = normalizeNumber(meta.kcal) * 7;
  const treinosPlanejados = weekDays.filter((day) => day.isPlanned).length;
  const treinosFeitos = weekDays.filter((day) => day.completedWorkoutCount > 0).length;

  return {
    selectedDate,
    realToday,
    meta,
    weekDays,
    dayData: selectedProjection.dayData,
    completedPlanItems: selectedProjection.completedPlanItems,
    complementaryLogs: selectedProjection.complementaryLogs,
    selectedPlannedWorkouts: plannedWorkouts[weekDays.find((day) => day.isSelected)?.dayKey] || [],
    weekKcal,
    metaSemana,
    treinosPlanejados,
    treinosFeitos,
    isCurrentWeek: toDateBR(getMonday(new Date())) === toDateBR(startOfWeek),
    isSelectedToday: selectedDate === realToday,
  };
}

export function rebuildHealthCacheDocs(docs) {
  const planDict = parsePlanoDict(docs.plano);
  const profile = parseJsonObject(docs.perfil, {});
  const plannedWorkouts = buildPlannedWorkouts(docs.perfil, docs.treinos);
  const existingCal = parseJsonObject(docs.cal, {});
  const existingTreinos = parseJsonObject(docs.treinos, {});
  const existingLogs = Array.isArray(existingTreinos.registros) ? existingTreinos.registros : [];
  const planDates = Object.keys(planDict);
  const firstPlanMeta = planDates.length > 0 ? normalizeMeta(planDict[planDates[0]]?.meta, profile) : normalizeMeta(null, profile);

  const nextCal = {
    meta_diaria: {
      kcal: firstPlanMeta.kcal,
      proteina_g: firstPlanMeta.proteina_g,
      carbo_g: firstPlanMeta.carbo_g,
      gordura_g: firstPlanMeta.gordura_g,
      fibra_g: firstPlanMeta.fibra_g,
    },
    dias: {},
  };

  for (const [date, rawDay] of Object.entries(existingCal.dias || {})) {
    if (!planDict[date]) {
      nextCal.dias[date] = rawDay;
    }
  }

  const planWorkoutRecords = [];
  for (const [date, day] of Object.entries(planDict)) {
    const projection = buildDayProjection({
      planDay: day,
      meta: normalizeMeta(day?.meta, profile),
      fallbackCalDay: existingCal.dias?.[date],
      logsForDay: [],
    });

    nextCal.dias[date] = {
      kcal_consumido: projection.dayData.kcal_consumido,
      proteina_g: projection.dayData.proteina_g,
      carbo_g: projection.dayData.carbo_g,
      gordura_g: projection.dayData.gordura_g,
      fibra_g: projection.dayData.fibra_g,
      refeicoes: projection.dayData.refeicoes.map((entry) => entry.text),
    };

    for (const item of getAllPlanItems(day)) {
      if (item.tipo !== "treino" || !item.checked) continue;
      planWorkoutRecords.push({
        data: date,
        tipo: String(item.treino_tipo || item.texto || "Treino"),
        duracao_min: normalizeNumber(item.duracao_min, 60),
        realizado: true,
        item_id: item.id || null,
        source: "plan",
      });
    }
  }

  const nextTreinos = {
    planejados: Object.fromEntries(
      Object.entries(plannedWorkouts).map(([dayKey, items]) => [dayKey, items.map((item) => item.label).join(" • ")])
    ),
    registros: [],
  };

  const mergedLogs = new Map();
  for (const existing of existingLogs) {
    if (!existing?.data || !existing?.tipo) continue;
    const key = existing.item_id
      ? `${existing.data}|${existing.tipo}|${existing.item_id}`
      : `${existing.data}|${existing.tipo}`;
    mergedLogs.set(key, { ...existing });
  }

  for (const record of planWorkoutRecords) {
    const key = record.item_id
      ? `${record.data}|${record.tipo}|${record.item_id}`
      : `${record.data}|${record.tipo}`;
    const existing = mergedLogs.get(key);
    mergedLogs.set(key, {
      ...existing,
      ...record,
      notas: String(existing?.notas || ""),
    });
  }

  nextTreinos.registros = Array.from(mergedLogs.values()).sort((a, b) => {
    if (a.data === b.data) return String(a.tipo).localeCompare(String(b.tipo));
    return parseDateBR(a.data) - parseDateBR(b.data);
  });

  return {
    ...docs,
    cal: JSON.stringify(nextCal),
    treinos: JSON.stringify(nextTreinos),
  };
}
