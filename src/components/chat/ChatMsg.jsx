import { useState } from "react";
import ChatBubbleContent from "./ChatBubbleContent.jsx";
import UpdateCard from "./UpdateCard.jsx";
import SecondaryBadge from "./SecondaryBadge.jsx";
import { groupRevisionsByType } from "../../utils/groupRevisions.js";
import { partitionPlanoVsSecondary } from "../../utils/secondaryUpdates.js";

export default function ChatMsg({ msg, msgIndex, setTab, onRevert }) {
  const isUser = msg.role === "user";
  const updates = msg.appliedUpdates || [];
  const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];
  const groupedUpdates = groupRevisionsByType(updates);
  const { planoGroups, secondaryGroups } = partitionPlanoVsSecondary(groupedUpdates);

  // State local: badge inline começa colapsada. Cards completos só aparecem
  // quando o usuário clica.
  const [secondaryExpanded, setSecondaryExpanded] = useState(false);

  async function handleRevertGroup(indexes) {
    if (!Array.isArray(indexes) || indexes.length === 0) return;
    if (!onRevert) return;

    // Reverte em ordem cronológica reversa para manter snapshots consistentes.
    const ordered = [...indexes].sort((a, b) => b - a);
    for (const idx of ordered) {
      await onRevert(msgIndex, idx);
    }
  }

  // Badge inline só pra mensagens do assistente com updates secundários.
  const showSecondaryBadge = !isUser && secondaryGroups.length > 0;

  return (
    <>
      <div className={`pt-chat__row ${isUser ? "pt-chat__row--user" : "pt-chat__row--assistant"}`}>
        {!isUser && <div className="pt-chat__avatar">🌿</div>}
        <div className={`pt-chat__bubble ${isUser ? "pt-chat__bubble--user" : "pt-chat__bubble--assistant"}`}>
          <ChatBubbleContent
            text={msg.content}
            trailing={showSecondaryBadge ? (
              <SecondaryBadge
                groups={secondaryGroups}
                expanded={secondaryExpanded}
                onToggle={() => setSecondaryExpanded((v) => !v)}
              />
            ) : null}
          />
          {isUser && attachments.length > 0 && (
            <div className="pt-chat__message-attachments">
              {attachments.map((attachment, index) => (
                <div key={`${attachment.mediaRef || index}`} className="pt-chat__message-attachment">
                  {attachment.kind === "image" && attachment.previewUrl ? (
                    <img src={attachment.previewUrl} alt="" className="pt-chat__message-attachment-thumb" />
                  ) : (
                    <span className="pt-chat__message-attachment-icon">{attachment.kind === "audio" ? "REC" : "IMG"}</span>
                  )}
                  <span>{attachment.label || (attachment.kind === "audio" ? "Audio" : "Imagem")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {isUser && (
          <div className="pt-chat__avatar" style={{ background: "linear-gradient(135deg,#C4956A,#A07050)" }}>🌸</div>
        )}
      </div>

      {/* Cards de plano: sempre visíveis (rich card, intacto).
          paddingLeft: 38px alinha o card com a borda esquerda da bolha,
          replicando o offset do avatar+gap (.pt-chat__avatar width=30px +
          .pt-chat__row gap=8px). Isso mantém o alinhamento consistente
          quer haja plano só, secundários só, ou os dois juntos.
          paddingRight: 8px preserva o breathing original. */}
      {planoGroups.length > 0 && (
        <div style={{ paddingLeft: "38px", paddingRight: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {planoGroups.map((group, gi) => (
            <UpdateCard
              key={`${msgIndex}-plano-${group.key}-${gi}`}
              revisions={group.revisions}
              setTab={setTab}
              onRevert={() => handleRevertGroup(group.indexes)}
            />
          ))}
        </div>
      )}

      {/* Cards secundários: só quando a badge inline está expandida.
          Mesmo offset horizontal do container de plano, garantindo que
          cards apareçam alinhados com a bolha mesmo quando NÃO há plano
          (caso comum de turnos só com anotação/perfil). Sem marginTop:
          o gap natural de .pt-chat__messages (14px) cuida do espaçamento. */}
      {secondaryExpanded && secondaryGroups.length > 0 && (
        <div style={{ paddingLeft: "38px", paddingRight: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {secondaryGroups.map((group, gi) => (
            <UpdateCard
              key={`${msgIndex}-secondary-${group.key}-${gi}`}
              revisions={group.revisions}
              setTab={setTab}
              onRevert={() => handleRevertGroup(group.indexes)}
            />
          ))}
        </div>
      )}
    </>
  );
}
