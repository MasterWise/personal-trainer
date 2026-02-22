import { renderInline } from "../../utils/formatters.js";

export default function ChatBubbleContent({ text }) {
  const lines = text.split("\n");
  return (
    <div>
      {lines.map((line, i) => {
        const isList = line.trim().startsWith("- ");
        const content = isList ? line.trim().slice(2) : line;
        if (!content.trim() && i < lines.length - 1) return <div key={i} style={{ height: "6px" }} />;
        return (
          <div key={i} style={{ display: "flex", gap: isList ? "7px" : "0", marginBottom: isList ? "3px" : "0" }}>
            {isList && <span style={{ opacity: 0.6, flexShrink: 0, marginTop: "1px" }}>–</span>}
            <span style={{ lineHeight: "1.6" }}>{renderInline(content)}</span>
          </div>
        );
      })}
    </div>
  );
}
