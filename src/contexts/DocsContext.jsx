import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext.jsx";
import { get, put, post } from "../services/api.js";

const DocsContext = createContext(null);

const DOC_KEYS = ["micro", "mem", "hist", "plano", "marcos", "cal", "treinos", "perfil", "macro"];

const FILE_TO_STATE = {
  micro: "micro",
  memoria: "mem",
  historico: "hist",
  plano: "plano",
  marcos: "marcos",
  calorias: "cal",
  treinos: "treinos",
};

const MARCO_EMOJIS = {
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
    marcos: "[]",
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

    setDocs((prev) => {
      const nd = { ...prev };
      try {
        if (update.file === "marcos" && update.action === "add_marco") {
          const marco = typeof update.content === "string"
            ? JSON.parse(update.content)
            : update.content;
          const arr = JSON.parse(prev.marcos || "[]");
          arr.push({
            id: Date.now(),
            date: new Date().toLocaleDateString("pt-BR", { month: "short", year: "numeric" }),
            emoji: MARCO_EMOJIS[marco.type] || "\u{1F3C6}",
            ...marco,
          });
          nd.marcos = JSON.stringify(arr);
          saveDoc("marcos", nd.marcos);
        } else if (update.action === "append") {
          const val = typeof update.content === "object" ? JSON.stringify(update.content) : update.content;
          nd[stateKey] = (prev[stateKey] || "") + "\n\n" + val;
          saveDoc(stateKey, nd[stateKey]);
        } else if (update.action === "replace_all") {
          const val = typeof update.content === "object" ? JSON.stringify(update.content) : update.content;
          nd[stateKey] = val;
          saveDoc(stateKey, val);
        }
      } catch (e) {
        console.error("applyUpdate:", e);
      }
      return nd;
    });
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
