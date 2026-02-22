import { useTheme } from "../../contexts/ThemeContext.jsx";
import { renderInline } from "../../utils/formatters.js";

export default function MD({ content }) {
  const { theme } = useTheme();
  const c = theme.colors;

  if (!content) return <p style={{ color: c.textMuted, fontFamily: theme.font, fontSize: "14px" }}>Carregando...</p>;
  if (typeof content !== "string") content = JSON.stringify(content, null, 2);

  return (
    <div>
      {content.split("\n").map((line, i) => {
        const trim = line.trim();
        if (!trim || trim === "---") return <div key={i} style={{ height: "8px" }} />;
        if (line.startsWith("# ")) return <h1 key={i} style={{ fontFamily: theme.headingFont, color: c.text, fontSize: "20px", fontWeight: "700", marginBottom: "2px", marginTop: "4px" }}>{line.slice(2)}</h1>;
        if (line.startsWith("## ")) return <h2 key={i} style={{ fontFamily: theme.headingFont, color: c.textSecondary, fontSize: "16px", fontWeight: "700", marginTop: "18px", marginBottom: "4px", paddingBottom: "4px", borderBottom: `1px solid ${c.border}` }}>{line.slice(3)}</h2>;
        if (line.startsWith("### ")) return <h3 key={i} style={{ fontFamily: theme.font, color: c.textSecondary, fontSize: "12px", fontWeight: "700", marginTop: "12px", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.07em" }}>{line.slice(4)}</h3>;
        if (line.startsWith("> ")) return <div key={i} style={{ background: c.primaryBg, borderLeft: `3px solid ${c.primary}`, padding: "8px 12px", borderRadius: "0 8px 8px 0", fontFamily: theme.font, color: c.textSecondary, fontSize: "13px", fontStyle: "italic", margin: "4px 0" }}>{line.slice(2)}</div>;
        if (line.match(/^[-*] /)) {
          return (
            <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "5px" }}>
              <span style={{ color: c.primary, flexShrink: 0, marginTop: "2px" }}>•</span>
              <span style={{ fontFamily: theme.font, color: c.textSecondary, fontSize: "13.5px", lineHeight: "1.55" }}>{renderInline(line.slice(2))}</span>
            </div>
          );
        }
        if (trim.match(/^\d+\. /)) {
          const num = trim.match(/^(\d+)\. /)[1];
          return (
            <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "5px" }}>
              <span style={{ color: c.primary, flexShrink: 0, fontWeight: "700", fontSize: "13px", minWidth: "16px" }}>{num}.</span>
              <span style={{ fontFamily: theme.font, color: c.textSecondary, fontSize: "13.5px", lineHeight: "1.55" }}>{renderInline(trim.replace(/^\d+\. /, ""))}</span>
            </div>
          );
        }
        return <p key={i} style={{ fontFamily: theme.font, color: c.textSecondary, fontSize: "13.5px", lineHeight: "1.6", marginBottom: "2px" }}>{renderInline(line)}</p>;
      })}
    </div>
  );
}
