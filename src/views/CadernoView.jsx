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
    title: "Visão",
    emoji: "🎯",
    subtitle: "Estratégia de longo prazo e metas",
    emptyMsg: "A visão geral ainda está em branco. Peça ao coach para traçar sua estratégia!",
  },
  {
    key: "micro",
    title: "Perfil",
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
      {/* Sticky header with padded segmented control */}
      <div style={{
        background: c.surface, borderBottom: `1px solid ${c.border}`,
        padding: "16px 16px 12px", flexShrink: 0,
        boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
      }}>
        {/* Title and fixed description with unified premium look */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
          <div style={{
            background: `linear-gradient(135deg, ${c.primaryLight}30, ${c.primary}20)`,
            width: "38px", height: "38px", borderRadius: "10px",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "18px", flexShrink: 0, border: `1px solid ${c.primary}20`
          }}>
            📓
          </div>
          <div>
            <h2 style={{ fontFamily: theme.headingFont, color: c.text, fontSize: "17px", fontWeight: "700", margin: 0, letterSpacing: "-0.01em" }}>
              Caderno do Coach
            </h2>
            <p style={{
              fontFamily: theme.font, color: c.textMuted, fontSize: "11.5px",
              margin: "2px 0 0", lineHeight: "1.3",
            }}>
              {active.subtitle}
            </p>
          </div>
        </div>

        {/* Tab bar — iOS-style Segmented Control */}
        <div style={{
          display: "flex", background: c.bg, borderRadius: "12px", padding: "4px",
          border: `1px solid ${c.border}`
        }}>
          {DOCS.map(doc => {
            const isActive = doc.key === activeDoc;
            const hasContent = !!(docsMap[doc.key] || "").trim();
            return (
              <button
                key={doc.key}
                onClick={() => setActiveDoc(doc.key)}
                style={{
                  flex: 1, padding: "7px 2px", border: "none", cursor: "pointer",
                  background: isActive ? c.surface : "transparent",
                  borderRadius: "8px",
                  boxShadow: isActive ? "0 2px 6px rgba(0,0,0,0.05)" : "none",
                  fontFamily: theme.font, fontSize: "11.5px", fontWeight: isActive ? "700" : "600",
                  color: isActive ? c.primary : c.textMuted,
                  whiteSpace: "nowrap", transition: "all 0.2s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                }}
              >
                {doc.title}
                {hasContent && !isActive && (
                  <span style={{
                    width: "4px", height: "4px", borderRadius: "50%",
                    background: c.primary, opacity: 0.6,
                  }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content area */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", background: c.bg, display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

          {/* Document content */}
          {content.trim() ? (
            <div style={{
              flex: 1,
              background: c.surface, padding: "24px 16px 36px",
              borderBottom: `1px solid ${c.border}`,
            }}>
              <MD content={content} />
            </div>
          ) : (
            <div style={{
              flex: 1,
              background: c.surface, padding: "40px 24px",
              borderBottom: `1px solid ${c.border}`, textAlign: "center",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: "40px", display: "block", marginBottom: "14px" }}>{active.emoji}</span>
              <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "13px", lineHeight: "1.6", maxWidth: "260px", margin: "0 auto" }}>
                {active.emptyMsg}
              </p>
            </div>
          )}

          <div style={{ padding: "0 16px 28px" }}>
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
    </div>
  );
}
