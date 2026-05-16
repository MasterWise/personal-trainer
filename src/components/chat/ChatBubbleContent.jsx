import { renderInline } from "../../utils/formatters.js";

/**
 * Renderiza o conteúdo textual da bolha do chat.
 *
 * @param {string} text - texto da mensagem.
 * @param {React.ReactNode} [trailing] - elemento opcional renderizado inline
 *   no fim da última linha de texto (ex.: badge minimalista de updates
 *   secundários). Não consome linha nova: flui junto da última frase, e se
 *   não couber, quebra naturalmente.
 */
export default function ChatBubbleContent({ text, trailing = null }) {
  const lines = text.split("\n");
  const lastIndex = lines.length - 1;
  return (
    <div>
      {lines.map((line, i) => {
        const isList = line.trim().startsWith("- ");
        const content = isList ? line.trim().slice(2) : line;
        const isLast = i === lastIndex;
        // Linha em branco no meio do texto vira espaçamento. No fim, se há
        // trailing pra renderizar, mantemos a linha pra o trailing aparecer.
        if (!content.trim() && !isLast) return <div key={i} style={{ height: "6px" }} />;
        return (
          <div key={i} style={{ display: "flex", gap: isList ? "7px" : "0", marginBottom: isList ? "3px" : "0", flexWrap: "wrap" }}>
            {isList && <span style={{ opacity: 0.6, flexShrink: 0, marginTop: "1px" }}>–</span>}
            <span style={{ lineHeight: "1.6" }}>
              {renderInline(content)}
              {isLast && trailing}
            </span>
          </div>
        );
      })}
    </div>
  );
}
