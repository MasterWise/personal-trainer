import React from "react";

export function renderInline(text) {
  const parts = text.split(/\*(.*?)\*/g);
  return parts.map((p, i) =>
    i % 2 === 1
      ? React.createElement("strong", { key: i, style: { fontWeight: "700" } }, p)
      : p
  );
}
