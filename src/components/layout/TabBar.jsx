import { TABS } from "../../data/constants.js";

export default function TabBar({ tab, setTab }) {
  return (
    <div className="pt-tabs">
      {TABS.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)}
          className={`pt-tabs__item ${tab === t.id ? "pt-tabs__item--active" : ""}`}>
          <span className="pt-tabs__icon">{t.icon}</span>
          <span className="pt-tabs__label">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
