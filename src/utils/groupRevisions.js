export function groupRevisionsByType(revisions) {
  if (!Array.isArray(revisions) || revisions.length === 0) return [];

  const map = new Map();
  const groups = [];

  revisions.forEach((revision, index) => {
    if (!revision || typeof revision !== "object") return;
    const file = revision.file || "unknown";
    const key = file;

    if (!map.has(key)) {
      const group = {
        key,
        file,
        revisions: [],
        indexes: [],
      };
      map.set(key, group);
      groups.push(group);
    }

    const group = map.get(key);
    group.revisions.push(revision);
    group.indexes.push(index);
  });

  return groups;
}
