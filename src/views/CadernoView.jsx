import { useState, useEffect, useRef } from "react";
import { useTheme } from "../contexts/ThemeContext.jsx";
import MD from "../components/ui/MD.jsx";

const DOCS = [
  {
    key: "hist",
    title: "Histórico",
    emoji: "📈",
    subtitle: "Registros de peso, medidas e evolução",
    emptyMsg: "Nenhum histórico registrado ainda. Converse com o coach e ele vai anotando tudo!",
  },
  {
    key: "mem",
    title: "Anotações",
    emoji: "📝",
    subtitle: "Padrões, insights e observações do coach",
    emptyMsg: "O coach ainda não tem anotações. Com o tempo, ele vai registrando insights sobre você.",
  },
  {
    key: "macro",
    title: "Visão Geral",
    emoji: "🎯",
    subtitle: "Estratégia de longo prazo e metas",
    emptyMsg: "A visão geral ainda está em branco. Peça ao coach para traçar sua estratégia!",
  },
  {
    key: "micro",
    title: "Perfil Íntimo",
    emoji: "👤",
    subtitle: "Preferências, rotina e comportamento",
    emptyMsg: "O coach ainda não registrou seu perfil detalhado. Converse mais para ele te conhecer!",
  },
];

export default function CadernoView({ hist, mem, macro, micro }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [activeDoc, setActiveDoc] = useState("hist");
  const bottomRef = useRef(null);
  const scrollRef = useRef(null);

  const docsMap = { hist, mem, macro, micro };
  const active = DOCS.find(d => d.key === activeDoc) || DOCS[0];
  const content = docsMap[active.key] || "";

  // Auto-scroll to bottom when switching tabs or content changes
  useEffect(() => {
    if (content.trim()) {
      // Small delay to let MD render
      const t = setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 80);
      return () => clearTimeout(t);
    } else if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [activeDoc, content]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: c.bg }}>
      {/* Sticky header with tabs */}
      <div style={{
        background: c.surface, borderBottom: `1px solid ${c.border}`,
        padding: "12px 16px 0", flexShrink: 0,
      }}>
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <span style={{ fontSize: "18px" }}>📓</span>
          <h2 style={{ fontFamily: theme.headingFont, color: c.text, fontSize: "16px", fontWeight: "700", margin: 0 }}>
            Caderno do Coach
          </h2>
        </div>

        {/* Tab bar */}
        <div style={{
          display: "flex", gap: "2px",
          overflowX: "auto", WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none", msOverflowStyle: "none",
        }}>
          {DOCS.map(doc => {
            const isActive = doc.key === activeDoc;
            const hasContent = !!(docsMap[doc.key] || "").trim();
            return (
              <button
                key={doc.key}
                onClick={() => setActiveDoc(doc.key)}
                style={{
                  padding: "8px 12px", border: "none", cursor: "pointer",
                  background: "transparent",
                  borderBottom: isActive ? `2.5px solid ${c.primary}` : "2.5px solid transparent",
                  fontFamily: theme.font, fontSize: "12.5px", fontWeight: isActive ? "700" : "500",
                  color: isActive ? c.primary : c.textMuted,
                  whiteSpace: "nowrap", transition: "all 0.2s",
                  display: "flex", alignItems: "center", gap: "4px",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: "13px" }}>{doc.emoji}</span>
                {doc.title}
                {hasContent && !isActive && (
                  <span style={{
                    width: "5px", height: "5px", borderRadius: "50%",
                    background: c.primary, opacity: 0.5, flexShrink: 0,
                  }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content area */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", background: c.bg }}>
        <div style={{ padding: "14px 16px 28px" }}>
          {/* Subtitle */}
          <p style={{
            fontFamily: theme.font, color: c.textSecondary, fontSize: "12px",
            marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px",
          }}>
            <span style={{ fontSize: "14px" }}>{active.emoji}</span>
            {active.subtitle}
          </p>

          {/* Document content */}
          {content.trim() ? (
            <div style={{
              background: c.surface, borderRadius: "16px", padding: "18px",
              border: `1px solid ${c.border}`, boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
            }}>
              <MD content={content} />
            </div>
          ) : (
            <div style={{
              background: c.surface, borderRadius: "16px", padding: "36px 24px",
              border: `1px solid ${c.border}`, textAlign: "center",
            }}>
              <span style={{ fontSize: "40px", display: "block", marginBottom: "14px" }}>{active.emoji}</span>
              <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "13px", lineHeight: "1.6", maxWidth: "260px", margin: "0 auto" }}>
                {active.emptyMsg}
              </p>
            </div>
          )}

          <p style={{
            fontFamily: theme.font, color: c.textMuted, fontSize: "10.5px",
            textAlign: "center", marginTop: "18px", fontStyle: "italic",
          }}>
            ✏️ Gerenciado automaticamente pelo coach durante suas conversas.
          </p>

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
