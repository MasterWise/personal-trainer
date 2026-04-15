import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { get, put, post } from "../services/api.js";
import { rebuildHealthCacheDocs } from "../utils/healthModel.js";
import { applyAiCheckedOwnership, applyAiOwnershipToPlanDay, canAiMutatePlanItem } from "../utils/planItemOwnership.js";
import { hashString } from "../utils/stringHash.js";

const DocsContext = createContext(null);

const DOC_KEYS = ["micro", "mem", "hist", "plano", "progresso", "cal", "treinos", "perfil", "macro", "medidas"];

// Files derived from plano — direct AI updates are silently dropped.
// Health data (calorias, treinos) is rebuilt from plano by rebuildHealthCacheDocs().
const DERIVED_FILES = new Set(["calorias", "treinos"]);

const FILE_TO_STATE = {
  micro: "micro",
  memoria: "mem",
  historico: "hist",
  plano: "plano",
  progresso: "progresso",
  calorias: "cal",
  treinos: "treinos",
  medidas: "medidas",
};

const PROGRESSO_EMOJIS = {
  "Conquista": "\u{1F3C6}",
  "Obst\u00e1culo superado": "\u{1F4AA}",
  "Mudan\u00e7a de fase": "\u{1F504}",
  "Dificuldade": "\u{1F4CC}",
};

// Normalize group names for accent-insensitive matching (e.g., "Almoço" matches "almoco")
function normalizeGroupName(name) {
  return String(name || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function emptyDocs() {
  return {
    micro: "",
    mem: "",
    hist: "",
    plano: "",
    progresso: "[]",
    cal: "{}",
    treinos: "{}",
    perfil: "{}",
    macro: "",
    medidas: "[]",
  };
}

function cloneDocs(docs) {
  return { ...docs };
}

function parseJson(value, fallback) {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string") return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function parseArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parsePlanoDict(planoStr, fallbackDate = null) {
  const parsed = parseJson(planoStr, {});
  if (Array.isArray(parsed)) return {};
  if (parsed.grupos) {
    const dateKey = parsed.date || fallbackDate || new Date().toLocaleDateString("pt-BR");
    return { [dateKey]: parsed };
  }
  return parsed;
}

function serializeDocsFromResponse(res) {
  const loaded = emptyDocs();
  if (res.documents && typeof res.documents === "object") {
    for (const key of DOC_KEYS) {
      if (res.documents[key] !== undefined && res.documents[key] !== null) {
        loaded[key] = res.documents[key];
      }
    }
  }

  // Migration: bootstrap medidas from perfil on first load only.
  // Check if medidas was NOT present in the server response (truly missing vs intentionally empty).
  if (res.documents && res.documents.medidas === undefined) {
    try {
      const perfil = JSON.parse(loaded.perfil || "{}");
      if (perfil.peso_kg || perfil.gordura_pct) {
        const seed = [{
          data: new Date().toLocaleDateString("pt-BR"),
          peso_kg: perfil.peso_kg || null,
          gordura_pct: perfil.gordura_pct || null,
          tmb_kcal: perfil.tmb_kcal || null,
          circunferencias: {},
          metodo: "perfil",
          notas: "Migrado do perfil existente",
        }];
        loaded.medidas = JSON.stringify(seed);
      }
    } catch { /* ignore */ }
  }

  return loaded;
}

function diffDocKeys(prevDocs, nextDocs) {
  return DOC_KEYS.filter((key) => prevDocs[key] !== nextDocs[key]);
}

function buildPatchMicro(prevValue, content) {
  if (content && typeof content === "object") {
    const search = typeof content.search === "string" ? content.search : content.find;
    const replacement = typeof content.replace === "string" ? content.replace : content.value;
    if (typeof search === "string" && typeof replacement === "string" && search) {
      return prevValue.includes(search) ? prevValue.replace(search, replacement) : `${prevValue}\n${replacement}`.trim();
    }
    if (typeof content.text === "string" && content.text.trim()) {
      return content.text.trim();
    }
  }

  const text = typeof content === "string" ? content.trim() : JSON.stringify(content);
  if (!text) return prevValue;
  return text.startsWith("#") ? text : `${prevValue}\n${text}`.trim();
}

function buildRevision(update, stateKey, before, after, batchId) {
  return {
    file: update.file,
    action: update.action,
    docKey: stateKey,
    batchId,
    before,
    after,
    beforeHash: hashString(before),
    afterHash: hashString(after),
    canRevert: true,
    revertedAt: null,
  };
}

function applySingleUpdateToDocs(docs, update, batchId) {
  const stateKey = FILE_TO_STATE[update.file];
  if (!stateKey) {
    return { nextDocs: docs, revision: null };
  }

  const before = docs[stateKey] || "";
  const nextDocs = cloneDocs(docs);
  let newVal = null;

  if (update.file === "progresso" && update.action === "add_progresso") {
    const progresso = typeof update.content === "string" ? parseJson(update.content, null) : update.content;
    if (!progresso || typeof progresso !== "object") {
      console.error("[DocsContext] Falha ao parsear update content:", { file: update.file, action: update.action });
      return { nextDocs: docs, revision: null };
    }
    const arr = parseArray(before);
    arr.push({
      id: Date.now(),
      date: new Date().toLocaleDateString("pt-BR", { month: "short", year: "numeric" }),
      emoji: PROGRESSO_EMOJIS[progresso.type] || "\u{1F3C6}",
      ...progresso,
    });
    newVal = JSON.stringify(arr);
  } else if (update.file === "medidas" && update.action === "add_medida") {
    const medida = typeof update.content === "string" ? parseJson(update.content, null) : update.content;
    if (!medida || typeof medida !== "object") {
      console.error("[DocsContext] Falha ao parsear update content:", { file: update.file, action: update.action });
      return { nextDocs: docs, revision: null };
    }
    // Validate ranges
    if (medida.peso_kg != null && (medida.peso_kg <= 0 || medida.peso_kg > 300)) {
      console.error("[DocsContext] peso_kg fora do range valido:", medida.peso_kg);
      return { nextDocs: docs, revision: null };
    }
    if (medida.gordura_pct != null && (medida.gordura_pct < 0 || medida.gordura_pct > 80)) {
      console.error("[DocsContext] gordura_pct fora do range valido:", medida.gordura_pct);
      return { nextDocs: docs, revision: null };
    }
    if (medida.tmb_kcal != null && (medida.tmb_kcal <= 0 || medida.tmb_kcal > 10000)) {
      console.error("[DocsContext] tmb_kcal fora do range valido:", medida.tmb_kcal);
      return { nextDocs: docs, revision: null };
    }
    const arr = parseArray(before);
    arr.push({
      data: medida.data || new Date().toLocaleDateString("pt-BR"),
      ...medida,
    });
    newVal = JSON.stringify(arr);

    // Sync perfil with latest body values from AI medida
    if (medida.peso_kg || medida.gordura_pct || medida.tmb_kcal) {
      try {
        const perfil = JSON.parse(docs.perfil || "{}");
        let changed = false;
        if (medida.peso_kg && medida.peso_kg !== perfil.peso_kg) { perfil.peso_kg = medida.peso_kg; changed = true; }
        if (medida.gordura_pct && medida.gordura_pct !== perfil.gordura_pct) { perfil.gordura_pct = medida.gordura_pct; changed = true; }
        if (medida.tmb_kcal && medida.tmb_kcal !== perfil.tmb_kcal) { perfil.tmb_kcal = medida.tmb_kcal; changed = true; }
        if (changed) {
          nextDocs.perfil = JSON.stringify(perfil, null, 2);
        }
      } catch { /* ignore perfil sync failure */ }
    }
  } else if (update.action === "append") {
    const val = typeof update.content === "object" ? JSON.stringify(update.content) : String(update.content || "");
    newVal = `${before}${before ? "\n\n" : ""}${val}`.trim();
  } else if (update.action === "replace_all") {
    if (stateKey === "plano") {
      let incomingObj = typeof update.content === "string" ? parseJson(update.content, null) : update.content;
      if (!incomingObj || typeof incomingObj !== "object") {
        console.error("[DocsContext] Falha ao parsear update content:", { file: update.file, action: update.action });
        return { nextDocs: docs, revision: null };
      }
      incomingObj = applyAiOwnershipToPlanDay(incomingObj);
      const targetDate = update.targetDate || incomingObj?.date || new Date().toLocaleDateString("pt-BR");
      const dict = parsePlanoDict(before, targetDate);
      dict[targetDate] = incomingObj;
      newVal = JSON.stringify(dict);
    } else {
      newVal = typeof update.content === "object" ? JSON.stringify(update.content) : String(update.content || "");
    }
  } else if (["append_item", "patch_item", "delete_item"].includes(update.action) && stateKey === "plano") {
    const itemData = typeof update.content === "string" ? parseJson(update.content, null) : update.content;
    if (!itemData || typeof itemData !== "object") {
      console.error("[DocsContext] Falha ao parsear update content:", { file: update.file, action: update.action });
      return { nextDocs: docs, revision: null };
    }
    const targetDate = update.targetDate || update.date || itemData.date || new Date().toLocaleDateString("pt-BR");
    const permissionApproved = update.permissionApproved === true;
    const dict = parsePlanoDict(before, targetDate);
    if (!dict[targetDate]) {
      dict[targetDate] = {
        date: targetDate,
        meta: { kcal: 1450, proteina_g: 115, carbo_g: 110, gordura_g: 45, fibra_g: 25 },
        grupos: [],
      };
    }
    const daily = dict[targetDate];

    if (update.action === "append_item") {
      let groupIndex = itemData.grupoIndex;
      if (groupIndex === undefined) {
        const targetName = normalizeGroupName(itemData.grupoNome || "nenhum");
        groupIndex = daily.grupos.findIndex((group) => normalizeGroupName(group.nome).includes(targetName));
      }
      if (groupIndex === -1 || groupIndex === undefined) {
        daily.grupos.push({ nome: itemData.grupoNome || "Outros", emoji: "📝", itens: [] });
        groupIndex = daily.grupos.length - 1;
      }
      if (!daily.grupos[groupIndex].itens) daily.grupos[groupIndex].itens = [];
      daily.grupos[groupIndex].itens.push(applyAiCheckedOwnership({ ...(itemData.item || {}) }));
    } else {
      for (const group of daily.grupos) {
        const itemIndex = group.itens.findIndex((item) => item.id === itemData.id);
        if (itemIndex === -1) continue;
        const currentItem = group.itens[itemIndex];
        if (update.action === "delete_item") {
          if (permissionApproved || canAiMutatePlanItem(currentItem)) {
            group.itens.splice(itemIndex, 1);
          }
        } else if (update.action === "patch_item") {
          if (!permissionApproved && !canAiMutatePlanItem(currentItem)) {
            break;
          }
          const patch = { ...(itemData.patch || {}) };
          if ("checked_source" in patch) delete patch.checked_source;
          group.itens[itemIndex] = applyAiCheckedOwnership({ ...currentItem, ...patch });
        }
        break;
      }
    }

    newVal = JSON.stringify(dict);
  } else if (update.action === "append_micro" && stateKey === "micro") {
    const val = typeof update.content === "object" ? JSON.stringify(update.content) : String(update.content || "");
    newVal = `${before}${before ? "\n" : ""}${val}`.trim();
  } else if (update.action === "patch_micro" && stateKey === "micro") {
    newVal = buildPatchMicro(before, update.content);
  } else if (update.action === "update_calorias_day" && stateKey === "cal") {
    const dayData = typeof update.content === "string" ? parseJson(update.content, null) : update.content;
    if (!dayData || typeof dayData !== "object") {
      console.error("[DocsContext] Falha ao parsear update content:", { file: update.file, action: update.action });
      return { nextDocs: docs, revision: null };
    }
    const calObj = parseJson(before, {});
    if (!calObj.dias) calObj.dias = {};
    const dayKey = dayData.data || new Date().toLocaleDateString("pt-BR");
    calObj.dias[dayKey] = { ...(calObj.dias[dayKey] || {}), ...dayData };
    delete calObj.dias[dayKey].data;
    newVal = JSON.stringify(calObj);
  } else if (update.action === "log_treino_day" && stateKey === "treinos") {
    const treinoData = typeof update.content === "string" ? parseJson(update.content, null) : update.content;
    if (!treinoData || typeof treinoData !== "object") {
      console.error("[DocsContext] Falha ao parsear update content:", { file: update.file, action: update.action });
      return { nextDocs: docs, revision: null };
    }
    const treinosObj = parseJson(before, {});
    if (!Array.isArray(treinosObj.registros)) treinosObj.registros = [];
    treinosObj.registros.push(treinoData);
    newVal = JSON.stringify(treinosObj);
  } else if (update.action === "patch_coach_note" && stateKey === "plano") {
    const noteData = typeof update.content === "string" ? parseJson(update.content, null) : update.content;
    if (!noteData || typeof noteData !== "object") {
      console.error("[DocsContext] Falha ao parsear update content:", { file: update.file, action: update.action });
      return { nextDocs: docs, revision: null };
    }
    const targetDate = update.targetDate || noteData.date || new Date().toLocaleDateString("pt-BR");
    const dict = parsePlanoDict(before, targetDate);
    if (!dict[targetDate]) {
      dict[targetDate] = {
        date: targetDate,
        meta: { kcal: 1450, proteina_g: 115, carbo_g: 110, gordura_g: 45, fibra_g: 25 },
        grupos: [],
      };
    }
    dict[targetDate].notaCoach = String(noteData.nota || noteData.note || "");
    newVal = JSON.stringify(dict);
  } else if (update.action === "append_coach_note" && stateKey === "plano") {
    const noteData = typeof update.content === "string" ? parseJson(update.content, null) : update.content;
    if (!noteData || typeof noteData !== "object") {
      console.error("[DocsContext] Falha ao parsear update content:", { file: update.file, action: update.action });
      return { nextDocs: docs, revision: null };
    }
    const targetDate = update.targetDate || noteData.date || new Date().toLocaleDateString("pt-BR");
    const dict = parsePlanoDict(before, targetDate);
    if (!dict[targetDate]) {
      dict[targetDate] = {
        date: targetDate,
        meta: { kcal: 1450, proteina_g: 115, carbo_g: 110, gordura_g: 45, fibra_g: 25 },
        grupos: [],
      };
    }
    const prevNote = String(dict[targetDate].notaCoach || "");
    const appendNote = String(noteData.nota || noteData.note || "").trim();
    dict[targetDate].notaCoach = [prevNote, appendNote].filter(Boolean).join("\n").trim();
    newVal = JSON.stringify(dict);
  }

  if (newVal === null || newVal === undefined || newVal === before) {
    return { nextDocs: docs, revision: null };
  }

  nextDocs[stateKey] = newVal;
  return {
    nextDocs,
    revision: buildRevision(update, stateKey, before, newVal, batchId),
  };
}

export function DocsProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [docs, setDocs] = useState(emptyDocs);
  const [docsStatus, setDocsStatus] = useState("loading");
  const [docsError, setDocsError] = useState(null);
  const [mutationSeq, setMutationSeq] = useState(0);
  const [docsGeneration, setDocsGeneration] = useState(0);
  const docsRef = useRef(emptyDocs());
  const mutationQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    docsRef.current = docs;
  }, [docs]);

  const docsReady = docsStatus === "ready";

  const loadAll = useCallback(async () => {
    const res = await get("/documents");
    return serializeDocsFromResponse(res);
  }, []);

  const reloadDocs = useCallback(async ({ markReady = true } = {}) => {
    const loaded = await loadAll();
    docsRef.current = loaded;
    setDocs(loaded);
    if (markReady) setDocsStatus("ready");
    setDocsError(null);
    return loaded;
  }, [loadAll]);

  useEffect(() => {
    if (!isAuthenticated) {
      const nextDocs = emptyDocs();
      docsRef.current = nextDocs;
      setDocs(nextDocs);
      setDocsStatus("loading");
      setDocsError(null);
      return;
    }

    let cancelled = false;
    setDocsStatus("loading");
    setDocsError(null);

    async function hydrate() {
      try {
        const loaded = await loadAll();
        if (cancelled) return;
        docsRef.current = loaded;
        setDocs(loaded);
        setDocsStatus("ready");
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Falha ao carregar documentos";
        setDocsStatus("error");
        setDocsError(message);
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, loadAll]);

  const persistDocs = useCallback(async (nextDocs, keys) => {
    if (!Array.isArray(keys) || keys.length === 0) return;

    if (keys.length === 1) {
      await put(`/documents/${keys[0]}`, { content: nextDocs[keys[0]] });
      return;
    }

    await put("/documents", keys.map((key) => ({ key, content: nextDocs[key] })));
  }, []);

  const enqueueMutation = useCallback((runner) => {
    const chained = mutationQueueRef.current.then(runner, runner);
    mutationQueueRef.current = chained.catch(() => {});
    return chained;
  }, []);

  const rebuildHealthCache = useCallback(async (nextDocsOrTransform) => {
    return enqueueMutation(async () => {
      const baseDocs = typeof nextDocsOrTransform === "function"
        ? nextDocsOrTransform(docsRef.current)
        : nextDocsOrTransform;
      const nextDocs = rebuildHealthCacheDocs(baseDocs);
      const changedKeys = diffDocKeys(docsRef.current, nextDocs).filter((key) => key === "cal" || key === "treinos");
      if (changedKeys.length === 0) return nextDocs;
      try {
        await persistDocs(nextDocs, changedKeys);
        docsRef.current = nextDocs;
        setDocs(nextDocs);
        setDocsError(null);
        setDocsStatus("ready");
        return nextDocs;
      } catch (error) {
        try {
          await reloadDocs({ markReady: true });
        } catch (reloadError) {
          const msg = reloadError instanceof Error ? reloadError.message : "Falha ao recarregar documentos";
          setDocsStatus("error");
          setDocsError(msg);
        }
        throw error;
      }
    });
  }, [enqueueMutation, persistDocs, reloadDocs]);

  const mutateDocs = useCallback(async (transform, options = {}) => {
    return enqueueMutation(async () => {
      const prevDocs = docsRef.current;
      const baseNextDocs = typeof transform === "function" ? transform(prevDocs) : { ...prevDocs, ...transform };
      const nextDocs = options.rebuildHealthCache ? rebuildHealthCacheDocs(baseNextDocs) : baseNextDocs;
      const changedKeys = Array.isArray(options.persistKeys)
        ? options.persistKeys.filter((key) => prevDocs[key] !== nextDocs[key])
        : diffDocKeys(prevDocs, nextDocs);

      if (changedKeys.length === 0) {
        return { docs: prevDocs, changedKeys: [] };
      }

      try {
        await persistDocs(nextDocs, changedKeys);
        docsRef.current = nextDocs;
        setDocs(nextDocs);
        setDocsError(null);
        setDocsStatus("ready");
        setMutationSeq((current) => current + 1);
        return { docs: nextDocs, changedKeys };
      } catch (error) {
        try {
          await reloadDocs({ markReady: true });
        } catch (reloadError) {
          const reloadMessage = reloadError instanceof Error ? reloadError.message : "Falha ao recarregar documentos";
          setDocsStatus("error");
          setDocsError(reloadMessage);
        }
        const message = error instanceof Error ? error.message : "Falha ao salvar documentos";
        setDocsError(message);
        throw error;
      }
    });
  }, [enqueueMutation, persistDocs, reloadDocs]);

  const saveDoc = useCallback(async (key, content, options = {}) => {
    return mutateDocs(
      (prevDocs) => ({ ...prevDocs, [key]: content }),
      {
        persistKeys: [key],
        rebuildHealthCache: options.rebuildHealthCache === true,
      }
    );
  }, [mutateDocs]);

  const applyUpdateBatch = useCallback(async (updates) => {
    const list = Array.isArray(updates) ? updates : [];
    if (list.length === 0) return [];

    return enqueueMutation(async () => {
      const prevDocs = docsRef.current;
      let workingDocs = prevDocs;
      const revisions = [];
      const touchedStateKeys = new Set();
      const batchId = crypto.randomUUID();

      for (const update of list) {
        if (DERIVED_FILES.has(update.file)) {
          console.warn(`[DocsContext] Dropping direct update to derived file "${update.file}" — health data is derived from plano`);
          continue;
        }
        const { nextDocs, revision } = applySingleUpdateToDocs(workingDocs, update, batchId);
        workingDocs = nextDocs;
        if (revision) {
          revisions.push(revision);
          touchedStateKeys.add(revision.docKey);
        }
      }

      if (revisions.length === 0) return [];

      const shouldRebuildHealth = touchedStateKeys.has("plano") || touchedStateKeys.has("perfil");
      const finalDocs = shouldRebuildHealth ? rebuildHealthCacheDocs(workingDocs) : workingDocs;
      const changedKeys = diffDocKeys(prevDocs, finalDocs);

      try {
        await persistDocs(finalDocs, changedKeys);
        docsRef.current = finalDocs;
        setDocs(finalDocs);
        setDocsError(null);
        setDocsStatus("ready");
        setMutationSeq((current) => current + 1);
        return revisions.map((revision) => {
          const after = finalDocs[revision.docKey];
          return {
            ...revision,
            after,
            afterHash: hashString(after),
          };
        });
      } catch (error) {
        try {
          await reloadDocs({ markReady: true });
        } catch (reloadError) {
          const reloadMessage = reloadError instanceof Error ? reloadError.message : "Falha ao recarregar documentos";
          setDocsStatus("error");
          setDocsError(reloadMessage);
        }
        const message = error instanceof Error ? error.message : "Falha ao aplicar atualizações";
        setDocsError(message);
        throw error;
      }
    });
  }, [enqueueMutation, persistDocs, reloadDocs]);

  const applyUpdate = useCallback(async (update) => {
    const revisions = await applyUpdateBatch([update]);
    return revisions[0] || null;
  }, [applyUpdateBatch]);

  const clearDocs = useCallback(async () => {
    return enqueueMutation(async () => {
      await post("/documents/reset");
      const loaded = await reloadDocs({ markReady: true });
      setDocsGeneration((current) => current + 1);
      return loaded;
    });
  }, [enqueueMutation, reloadDocs]);

  const restoreDocs = useCallback(async () => {
    return enqueueMutation(async () => {
      await post("/documents/restore");
      const loaded = await reloadDocs({ markReady: true });
      setDocsGeneration((current) => current + 1);
      return loaded;
    });
  }, [enqueueMutation, reloadDocs]);

  const contextValue = useMemo(() => ({
    docs,
    docsReady,
    docsStatus,
    docsError,
    mutationSeq,
    docsGeneration,
    setDocs,
    saveDoc,
    mutateDocs,
    applyUpdate,
    applyUpdateBatch,
    clearDocs,
    restoreDocs,
    reloadDocs,
    rebuildHealthCache,
  }), [
    docs,
    docsReady,
    docsStatus,
    docsError,
    mutationSeq,
    docsGeneration,
    saveDoc,
    mutateDocs,
    applyUpdate,
    applyUpdateBatch,
    clearDocs,
    restoreDocs,
    reloadDocs,
    rebuildHealthCache,
  ]);

  return (
    <DocsContext.Provider value={contextValue}>
      {children}
    </DocsContext.Provider>
  );
}

export function useDocs() {
  const ctx = useContext(DocsContext);
  if (!ctx) throw new Error("useDocs must be used within DocsProvider");
  return ctx;
}
