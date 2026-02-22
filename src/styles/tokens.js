export const C = {
  p: "#B87850",
  pl: "#D4956A",
  pbg: "#FDF5EE",
  w: "#FFFFFF",
  bg: "#F7F2EC",
  t: "#2C1A0E",
  m: "#6B4C35",
  l: "#9E7F68",
  b: "rgba(184,120,80,0.18)",
  ok: "#5A9A5A",
  okbg: "#EEF5EE",
};

export const tokens = {
  fontSize: { "2xs": "0.65rem", xs: "0.75rem", sm: "0.85rem", base: "1rem", lg: "1.25rem", xl: "1.5rem", "2xl": "2rem" },
  spacing: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48],
  radius: { sm: "8px", md: "12px", lg: "16px", xl: "18px", "2xl": "24px", full: "9999px" },
  colors: { ...C },
  shadows: {
    sm: "0 1px 4px rgba(0,0,0,0.06)",
    md: "0 2px 10px rgba(184,120,80,0.2)",
    lg: "0 4px 16px rgba(184,120,80,0.3)",
    glow: { primary: "0 3px 12px rgba(184,120,80,0.35)", ok: "0 3px 12px rgba(90,154,90,0.35)" },
  },
  transitions: { fast: "0.15s ease", default: "0.2s ease", slow: "0.3s ease" },
  zIndex: { base: 1, dropdown: 100, sticky: 200, modal: 300, bottomNav: 1000, tooltip: 1100 },
  fonts: { body: "'DM Sans', sans-serif", heading: "'Playfair Display', serif" },
};
