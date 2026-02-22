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
    if (!stateKey) return;

    // Read current docs from ref — always up-to-date, no stale closures
    const prevDocs = docsRef.current;

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
        newVal = typeof update.content === "object" ? JSON.stringify(update.content) : update.content;
      }

      if (newVal !== undefined && newVal !== "") {
        await saveDoc(stateKey, newVal);
        setDocs(current => ({ ...current, [stateKey]: newVal }));
      }
    } catch (e) {
      console.error("applyUpdate error:", update.file, e);
    }
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
