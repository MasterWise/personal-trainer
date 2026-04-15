import React, { useState } from "react";
import { useTheme } from "../../contexts/ThemeContext.jsx";

/**
 * Editable tag list — renders string array as removable tags with an add input.
 * Props: values (string[]), onChange (newValues => void), placeholder (string)
 */
export default function TagEditor({ values = [], onChange, placeholder = "Adicionar..." }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [input, setInput] = useState("");

  function addTag() {
    const trimmed = input.trim();
    if (!trimmed || values.includes(trimmed)) return;
    onChange([...values, trimmed]);
    setInput("");
  }

  function removeTag(idx) {
    onChange(values.filter((_, i) => i !== idx));
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
      {values.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "4px 10px",
            background: `${c.primary}12`,
            borderRadius: "14px",
            fontFamily: theme.font,
            fontSize: "12px",
            color: c.text,
          }}
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(i)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0 2px",
              fontSize: "13px",
              color: c.textMuted,
              lineHeight: 1,
            }}
            aria-label={`Remover ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{
            border: `1px dashed ${c.border}`,
            borderRadius: "14px",
            padding: "4px 10px",
            fontFamily: theme.font,
            fontSize: "12px",
            background: "transparent",
            color: c.text,
            outline: "none",
            flex: "1", minWidth: "80px", maxWidth: "150px",
          }}
        />
        {input.trim() && (
          <button
            type="button"
            onClick={addTag}
            style={{
              background: `${c.primary}15`,
              border: `1px solid ${c.primary}30`,
              borderRadius: "50%",
              width: "24px",
              height: "24px",
              cursor: "pointer",
              fontSize: "14px",
              color: c.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}
