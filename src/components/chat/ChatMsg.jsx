import ChatBubbleContent from "./ChatBubbleContent.jsx";
import UpdateCard from "./UpdateCard.jsx";

export default function ChatMsg({ msg, msgIndex, setTab, onRevert }) {
  const isUser = msg.role === "user";
  const updates = msg.appliedUpdates || [];

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
      {updates.length > 0 && (
        <div style={{ padding: "0 8px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {updates.map((rev, ri) => (
            <UpdateCard
              key={`${msgIndex}-${ri}`}
              revision={rev}
              setTab={setTab}
              onRevert={() => onRevert?.(msgIndex, ri)}
            />
          ))}
        </div>
      )}
    </>
  );
}
