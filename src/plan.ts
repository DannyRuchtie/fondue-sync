export type Entry = {
  id: string;
  kind: "token" | "style" | "icon" | "recipe" | "guide" | "example";
  definition: string;
};
export type RecordEntry = {
  nodeId: string;
  definition: string;
  snapshot: string;
};
export type Action = Entry & {
  action:
    "create" | "update" | "unchanged" | "conflict" | "missing" | "retained";
  reason?: string;
  changes?: string[];
};
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonical((value as any)[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "null";
}
// A complete source definition is compared, not a collision-prone short hash.
export function changedPaths(previous: any, next: any, prefix = ""): string[] {
  if (canonical(previous) === canonical(next)) return [];
  if (
    !previous ||
    !next ||
    typeof previous !== "object" ||
    typeof next !== "object" ||
    Array.isArray(previous) !== Array.isArray(next)
  )
    return [prefix || "definition"];
  return [...new Set([...Object.keys(previous), ...Object.keys(next)])]
    .flatMap((k) =>
      changedPaths(previous[k], next[k], prefix ? prefix + "." + k : k),
    )
    .slice(0, 30);
}
export function decide(
  entry: Entry,
  baseline: RecordEntry | undefined,
  actual: string | null,
): Action {
  if (!baseline) return { ...entry, action: "create" };
  if (actual === null)
    return {
      ...entry,
      action: "missing",
      reason:
        "Managed asset was removed. Restore it or use an explicit migration; no duplicate is created.",
    };
  if (actual !== baseline.snapshot)
    return {
      ...entry,
      action: "conflict",
      reason:
        "Managed Figma asset differs from last applied state. Local changes preserved.",
    };
  let changes: string[] = [];
  if (entry.definition !== baseline.definition) {
    try {
      changes = changedPaths(
        JSON.parse(baseline.definition),
        JSON.parse(entry.definition),
      );
    } catch {
      changes = ["definition"];
    }
  }
  return {
    ...entry,
    action: entry.definition === baseline.definition ? "unchanged" : "update",
    ...(changes.length ? { changes } : {}),
  };
}
