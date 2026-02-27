function normalizeText(value) {
  if (value == null) return "";
  return String(value);
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = sortKeysDeep(value[key]);
  }
  return out;
}

function normalizeForDiff(text) {
  const parsed = safeParseJson(text);
  if (parsed === null) return text;
  return JSON.stringify(sortKeysDeep(parsed), null, 2);
}

function trimLeadingLineBreaks(value) {
  return value.replace(/^[\r\n]+/, "");
}

function extractChangedWindow(beforeText, afterText) {
  if (beforeText === afterText) {
    return {
      beforeChanged: "",
      afterChanged: "",
      prefixOmitted: false,
      suffixOmitted: false,
    };
  }

  let start = 0;
  const minLen = Math.min(beforeText.length, afterText.length);
  while (start < minLen && beforeText[start] === afterText[start]) {
    start += 1;
  }

  let endBefore = beforeText.length - 1;
  let endAfter = afterText.length - 1;
  while (
    endBefore >= start &&
    endAfter >= start &&
      beforeText[endBefore] === afterText[endAfter]
  ) {
    endBefore -= 1;
    endAfter -= 1;
  }

  // Expand from char-diff to full changed lines for better readability in UI cards.
  const beforeLineStart = beforeText.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const afterLineStart = afterText.lastIndexOf("\n", Math.max(0, start - 1)) + 1;

  const beforeLineEndProbe = beforeText.indexOf("\n", endBefore + 1);
  const afterLineEndProbe = afterText.indexOf("\n", endAfter + 1);
  const beforeLineEnd = beforeLineEndProbe === -1 ? beforeText.length : beforeLineEndProbe;
  const afterLineEnd = afterLineEndProbe === -1 ? afterText.length : afterLineEndProbe;

  return {
    beforeChanged: beforeText.slice(beforeLineStart, beforeLineEnd),
    afterChanged: afterText.slice(afterLineStart, afterLineEnd),
    prefixOmitted: beforeLineStart > 0 || afterLineStart > 0,
    suffixOmitted: beforeLineEnd < beforeText.length || afterLineEnd < afterText.length,
  };
}

function withContextEllipsis(text, prefixOmitted, suffixOmitted) {
  const core = text || "(vazio)";
  const left = prefixOmitted ? "…\n" : "";
  const right = suffixOmitted ? "\n…" : "";
  return `${left}${core}${right}`;
}

export function buildRevisionDiff(action, before, after) {
  const beforeText = normalizeText(before);
  const afterText = normalizeText(after);

  if (action === "append" && afterText.startsWith(beforeText)) {
    const added = trimLeadingLineBreaks(afterText.slice(beforeText.length));
    return {
      hideBefore: true,
      beforeDisplay: "",
      afterDisplay: added || "(sem conteúdo novo)",
    };
  }

  const beforeForDiff = normalizeForDiff(beforeText);
  const afterForDiff = normalizeForDiff(afterText);
  const changed = extractChangedWindow(beforeForDiff, afterForDiff);
  return {
    hideBefore: action === "add_progresso",
    beforeDisplay: withContextEllipsis(changed.beforeChanged, changed.prefixOmitted, changed.suffixOmitted),
    afterDisplay: withContextEllipsis(changed.afterChanged, changed.prefixOmitted, changed.suffixOmitted),
  };
}
