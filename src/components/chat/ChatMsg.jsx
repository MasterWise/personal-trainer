import ChatBubbleContent from "./ChatBubbleContent.jsx";
import UpdateCard from "./UpdateCard.jsx";
import { groupRevisionsByType } from "../../utils/groupRevisions.js";

export default function ChatMsg({ msg, msgIndex, setTab, onRevert }) {
  const isUser = msg.role === "user";
  const updates = msg.appliedUpdates || [];
  const groupedUpdates = groupRevisionsByType(updates);

  async function handleRevertGroup(indexes) {
    if (!Array.isArray(indexes) || indexes.length === 0) return;
    if (!onRevert) return;

    // Revert in reverse chronological order to keep document snapshots consistent.
    const ordered = [...indexes].sort((a, b) => b - a);
    for (const idx of ordered) {
      // eslint-disable-next-line no-await-in-loop
      await onRevert(msgIndex, idx);
    }
  }

  return (
    <>
      <div className={`pt-chat__row ${isUser ? "pt-chat__row--user" : "pt-chat__row--assistant"}`}>
        {!isUser && <div className="pt-chat__avatar">🌿</div>}
        <div className={`pt-chat__bubble ${isUser ? "pt-chat__bubble--user" : "pt-chat__bubble--assistant"}`}>
          <ChatBubbleContent text={msg.content} />
        </div>
        {isUser && (
          <div className="pt-chat__avatar" style={{ background: "linear-gradient(135deg,#C4956A,#A07050)" }}>🌸</div>
        )}
      </div>
      {/* Persistent update cards attached to this message */}
      {groupedUpdates.length > 0 && (
        <div style={{ padding: "0 8px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {groupedUpdates.map((group, gi) => (
            <UpdateCard
              key={`${msgIndex}-${group.key}-${gi}`}
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
