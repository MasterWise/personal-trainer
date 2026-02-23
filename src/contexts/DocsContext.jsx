import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext.jsx";
import { get, put, post } from "../services/api.js";

const DocsContext = createContext(null);

const DOC_KEYS = ["micro", "mem", "hist", "plano", "progresso", "cal", "treinos", "perfil", "macro"];

const FILE_TO_STATE = {
  micro: "micro",
  memoria: "mem",
  historico: "hist",
  plano: "plano",
  progresso: "progresso",
  calorias: "cal",
  treinos: "treinos",
};

const PROGRESSO_EMOJIS = {
  "Conquista": "\u{1F3C6}",
  "Obst\u00e1culo superado": "\u{1F4AA}",
  "Mudan\u00e7a de fase": "\u{1F504}",
  "Dificuldade": "\u{1F4CC}",
};

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
  };
}

export function DocsProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [docs, setDocs] = useState(emptyDocs);
  const [docsReady, setDocsReady] = useState(false);
  // Ref always mirrors latest docs — safe to read in async callbacks without stale closures
  const docsRef = useRef(emptyDocs());
  useEffect(() => { docsRef.current = docs; }, [docs]);

  useEffect(() => {
    if (!isAuthenticated) {
      setDocs(emptyDocs());
      setDocsReady(false);
      return;
    }

    let cancelled = false;
    async function loadAll() {
      try {
        const res = await get("/documents");
        if (cancelled) return;
        const loaded = emptyDocs();
        if (res.documents && typeof res.documents === "object") {
          for (const key of DOC_KEYS) {
            if (res.documents[key] !== undefined && res.documents[key] !== null) {
              loaded[key] = res.documents[key];
            }
          }
        }
        setDocs(loaded);
      } catch {
        /* keep empty defaults */
      } finally {
        if (!cancelled) setDocsReady(true);
      }
    }
    loadAll();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const saveDoc = useCallback(async (key, content) => {
    try {
      await put(`/documents/${key}`, { content });
    } catch (e) {
      console.error("saveDoc:", key, e);
    }
  }, []);

  async function reloadDocs() {
    const res = await get("/documents");
    const loaded = emptyDocs();
    if (res.documents && typeof res.documents === "object") {
      for (const key of DOC_KEYS) {
        if (res.documents[key] !== undefined && res.documents[key] !== null) {
          loaded[key] = res.documents[key];
        }
      }
    }
    setDocs(loaded);
  }

  const clearDocs = useCallback(async () => {
    try {
      await post("/documents/reset");
      await reloadDocs();
    } catch (e) {
      console.error("clearDocs:", e);
    }
  }, []);

  const restoreDocs = useCallback(async () => {
    try {
      await post("/documents/restore");
      await reloadDocs();
    } catch (e) {
      console.error("restoreDocs:", e);
    }
  }, []);

  const applyUpdate = useCallback(async (update) => {
    const stateKey = FILE_TO_STATE[update.file];
    if (!stateKey) return null;

    // Capture the "before" state for revision ledger
    const prevDocs = docsRef.current;
    const before = prevDocs[stateKey] || "";

    try {
      let newVal = "";
      if (update.file === "progresso" && update.action === "add_progresso") {
        const progresso = typeof update.content === "string" ? JSON.parse(update.content) : update.content;
        const arr = JSON.parse(prevDocs.progresso || "[]");
        arr.push({
          id: Date.now(),
          date: new Date().toLocaleDateString("pt-BR", { month: "short", year: "numeric" }),
          emoji: PROGRESSO_EMOJIS[progresso.type] || "\u{1F3C6}",
          ...progresso,
        });
        newVal = JSON.stringify(arr);
      } else if (update.action === "append") {
        const val = typeof update.content === "object" ? JSON.stringify(update.content) : update.content;
        newVal = (prevDocs[stateKey] || "") + "\n\n" + val;
      } else if (update.action === "replace_all") {
        if (stateKey === "plano") {
          let incomingObj = typeof update.content === "string" ? JSON.parse(update.content) : update.content;
          const targetDate = incomingObj?.date || new Date().toLocaleDateString("pt-BR");
          
          let dict = {};
          if (prevDocs.plano) {
            try {
              const old = JSON.parse(prevDocs.plano);
              if (old.grupos && old.date) { dict[old.date] = old; } else { dict = old; }
            } catch { /* Ignore malformed */ }
          }
          dict[targetDate] = incomingObj;
          newVal = JSON.stringify(dict);
        } else {
          newVal = typeof update.content === "object" ? JSON.stringify(update.content) : update.content;
        }
      } else if (["append_item", "patch_item", "delete_item"].includes(update.action) && stateKey === "plano") {
        // Granular plano updates
        let itemData = typeof update.content === "string" ? JSON.parse(update.content) : update.content;
        const targetDate = update.date || itemData.date || new Date().toLocaleDateString("pt-BR");
        
        // Ensure dict exists
        let dict = {};
        if (prevDocs.plano) {
          try {
            const old = JSON.parse(prevDocs.plano);
            if (old.grupos && old.date) { dict[old.date] = old; } else { dict = old; }
          } catch {}
        }

        // Ensure daily plan exists
        if (!dict[targetDate]) dict[targetDate] = { date: targetDate, meta: { kcal: 1450, proteina_g: 115, carbo_g: 110, gordura_g: 45, fibra_g: 25 }, grupos: [] };
        const daily = dict[targetDate];

        if (update.action === "append_item") {
          // itemData must include { item: {...}, grupoIndex: 0 } or match by name
          let gi = itemData.grupoIndex !== undefined ? itemData.grupoIndex : daily.grupos.findIndex(g => g.nome.toLowerCase().includes(itemData.grupoNome?.toLowerCase() || "nenhum"));
          if (gi === -1) {
             daily.grupos.push({ nome: itemData.grupoNome || "Adicionados", emoji: "📝", itens: [] });
             gi = daily.grupos.length - 1;
          }
          if (!daily.grupos[gi].itens) daily.grupos[gi].itens = [];
          daily.grupos[gi].itens.push(itemData.item);
        } else if (update.action === "patch_item" || update.action === "delete_item") {
          // Require item.id
          for (const g of daily.grupos) {
            const idx = g.itens.findIndex(i => i.id === itemData.id);
            if (idx !== -1) {
              if (update.action === "delete_item") {
                // Remove unless checked
                if (!g.itens[idx].checked) g.itens.splice(idx, 1);
              } else if (update.action === "patch_item") {
                // Merge changes, ignore state change if already checked
                const wasChecked = g.itens[idx].checked;
                g.itens[idx] = { ...g.itens[idx], ...itemData.patch };
                if (wasChecked) g.itens[idx].checked = true; // Protect checked state
              }
              break;
            }
          }
        }
        
        newVal = JSON.stringify(dict);
      } else if (update.action === "append_micro" && stateKey === "micro") {
        // Append text to micro without overwriting
        const val = typeof update.content === "object" ? JSON.stringify(update.content) : update.content;
        newVal = (prevDocs.micro || "") + "\n" + val;
      } else if (update.action === "patch_micro" && stateKey === "micro") {
        // If micro is plain text, just append. If JSON-like, merge fields.
        const val = typeof update.content === "object" ? JSON.stringify(update.content) : update.content;
        // For text-based micro, treat patch as smart append at the relevant section
        newVal = (prevDocs.micro || "") + "\n" + val;
      } else if (update.action === "update_calorias_day" && stateKey === "cal") {
        // Update only one day's calorie data
        let dayData = typeof update.content === "string" ? JSON.parse(update.content) : update.content;
        let calObj = {};
        try { calObj = JSON.parse(prevDocs.cal || "{}"); } catch {}
        if (!calObj.dias) calObj.dias = {};
        const dayKey = dayData.data || new Date().toLocaleDateString("pt-BR");
        // Merge into existing day or create new
        calObj.dias[dayKey] = { ...(calObj.dias[dayKey] || {}), ...dayData };
        delete calObj.dias[dayKey].data; // Remove the routing key from stored data
        newVal = JSON.stringify(calObj);
      } else if (update.action === "log_treino_day" && stateKey === "treinos") {
        // Log a single training session without replacing the entire treinos object
        let treinoData = typeof update.content === "string" ? JSON.parse(update.content) : update.content;
        let treinosObj = {};
        try { treinosObj = JSON.parse(prevDocs.treinos || "{}"); } catch {}
        if (!treinosObj.registros) treinosObj.registros = [];
        treinosObj.registros.push(treinoData);
        newVal = JSON.stringify(treinosObj);
      } else if (update.action === "patch_coach_note" && stateKey === "plano") {
        // Set a daily coach note on the plan without touching items
        let noteData = typeof update.content === "string" ? JSON.parse(update.content) : update.content;
        const targetDate = noteData.date || new Date().toLocaleDateString("pt-BR");

        let dict = {};
        if (prevDocs.plano) {
          try {
            const old = JSON.parse(prevDocs.plano);
            if (old.grupos && old.date) { dict[old.date] = old; } else { dict = old; }
          } catch {}
        }
        if (!dict[targetDate]) dict[targetDate] = { date: targetDate, meta: { kcal: 1450, proteina_g: 115, carbo_g: 110, gordura_g: 45, fibra_g: 25 }, grupos: [] };
        dict[targetDate].notaCoach = noteData.nota || noteData.note || "";
        newVal = JSON.stringify(dict);
      }

      if (newVal !== undefined && newVal !== "") {
        await saveDoc(stateKey, newVal);
        setDocs(current => ({ ...current, [stateKey]: newVal }));
        return { file: update.file, action: update.action, before, after: newVal };
      }
    } catch (e) {
      console.error("applyUpdate error:", update.file, e);
    }
    return null;
  }, [saveDoc]);

  return (
    <DocsContext.Provider value={{ docs, docsReady, setDocs, saveDoc, applyUpdate, clearDocs, restoreDocs }}>
      {children}
    </DocsContext.Provider>
  );
}

export function useDocs() {
  const ctx = useContext(DocsContext);
  if (!ctx) throw new Error("useDocs must be used within DocsProvider");
  return ctx;
}
