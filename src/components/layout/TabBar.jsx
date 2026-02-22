import { TABS } from "../../data/constants.js";

const LOGS_TAB = { id: "logs", label: "Logs", icon: "🔍" };

export default function TabBar({ tab, setTab, unreadCount }) {
  const debugOn = typeof localStorage !== "undefined" && localStorage.getItem("debugAI") === "true";
  const tabs = debugOn ? [...TABS, LOGS_TAB] : TABS;

  return (
    <div className="pt-tabs">
      {tabs.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)}
          className={`pt-tabs__item ${tab === t.id ? "pt-tabs__item--active" : ""}`}>
          <span className="pt-tabs__icon" style={{ position: "relative" }}>
            {t.icon}
            {t.id === "chat" && unreadCount > 0 && (
              <span style={{
                position: "absolute", top: "-4px", right: "-8px",
                background: "var(--pt-color-danger)", color: "#fff",
                fontSize: "10px", fontWeight: "bold", padding: "2px 5px",
                borderRadius: "10px", lineHeight: 1
              }}>
                {unreadCount}
              </span>
            )}
          </span>
          <span className="pt-tabs__label">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
