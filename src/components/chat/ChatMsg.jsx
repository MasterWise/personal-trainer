import ChatBubbleContent from "./ChatBubbleContent.jsx";

export default function ChatMsg({ msg }) {
  const isUser = msg.role === "user";

  return (
    <div className={`pt-chat__row ${isUser ? "pt-chat__row--user" : "pt-chat__row--assistant"}`}>
      {!isUser && <div className="pt-chat__avatar">🌿</div>}
      <div className={`pt-chat__bubble ${isUser ? "pt-chat__bubble--user" : "pt-chat__bubble--assistant"}`}>
        <ChatBubbleContent text={msg.content} />
      </div>
      {isUser && (
        <div className="pt-chat__avatar" style={{ background: "linear-gradient(135deg,#C4956A,#A07050)" }}>🌸</div>
      )}
    </div>
  );
}
