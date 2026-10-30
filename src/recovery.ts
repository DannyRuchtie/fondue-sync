import { canonical, type Entry, type RecordEntry } from "./plan";
import { read } from "./metadata";
import type { Layer, Recipe } from "./schema";
/** Recovery is intentionally read-only. A caught initial-import failure may be
 * resumed only when its saved partial snapshot still matches the native asset.
 * This is not authorization to replace local edits, adopt unindexed nodes, repair
 * missing metadata or infer ownership from canvas names. */
export type PartialLayer = {
  nodeId: string;
  identity: string | null;
  type: string;
  children: PartialLayer[];
};
export type PartialVariant = {
  nodeId: string;
  variantId: string | null;
  root: PartialLayer;
};
export type PartialRecipe = {
  nodeId: string;
  type: string;
  variants: PartialVariant[];
};
export type RecoveryDecision = {
  status: "not-pending" | "resume" | "blocked";
  reason: string;
  preserveIds: string[];
};
export function inspectPartialRecipe(asset: any): PartialRecipe {
  const layer = (node: any): PartialLayer => ({
    nodeId: node.id,
    identity: read(node, "identity") || null,
    type: node.type,
    children: node.type === "INSTANCE" ? [] : (node.children ?? []).map(layer),
  });
  return {
    nodeId: asset.id,
    type: asset.type,
    variants: (asset.children ?? []).map((node: any) => ({
      nodeId: node.id,
      variantId: read(node, "variant") || null,
      root: layer(node),
    })),
  };
}
const compatible = (native: string, kind: Layer["kind"], root = false) =>
  root
    ? native === "COMPONENT"
    : kind === "frame"
      ? native === "FRAME"
      : kind === "text"
        ? native === "TEXT"
        : kind === "rectangle"
          ? native === "RECTANGLE"
          : kind === "ellipse"
            ? native === "ELLIPSE"
            : kind === "instance" || kind === "componentInstance"
              ? native === "INSTANCE"
              : kind === "svg"
                ? ["FRAME", "GROUP", "VECTOR"].includes(native)
                : false;
/** Validate a plugin-owned partial tree against the intended recipe. A subset is
 * allowed because failed construction can stop after any child. Existing native
 * IDs are returned for evidence, never removed/recreated. SVG internals and native
 * instance descendants belong to their source constructors and are not reparented.
 */
export function partialRecipeProblems(
  actual: PartialRecipe,
  target: Recipe,
): string[] {
  const problems: string[] = [];
  const seenNodes = new Set<string>();
  const seenVariants = new Set<string>();
  const visit = (
    native: PartialLayer,
    definition: Layer,
    path: string,
    root = false,
  ) => {
    if (seenNodes.has(native.nodeId))
      problems.push("Repeated native node ID " + native.nodeId);
    seenNodes.add(native.nodeId);
    if (native.identity && native.identity !== definition.id)
      problems.push("Managed layer identity differs at " + path);
    if (!native.identity && (!root || native.children.length > 0))
      problems.push("Unowned or incompletely tagged child at " + path);
    if (!compatible(native.type, definition.kind, root))
      problems.push("Native layer type differs at " + path);
    if (
      definition.kind === "svg" ||
      definition.kind === "instance" ||
      definition.kind === "componentInstance"
    )
      return;
    const children = new Map(
      (definition.children ?? []).map((child) => [child.id, child]),
    );
    const siblings = new Set<string>();
    for (const child of native.children) {
      if (!child.identity) {
        problems.push("Unowned or incompletely tagged child at " + path);
        continue;
      }
      if (siblings.has(child.identity))
        problems.push(
          "Duplicate managed child identity at " + path + "/" + child.identity,
        );
      siblings.add(child.identity);
      const match = children.get(child.identity);
      if (!match) {
        problems.push(
          "Unexpected managed child at " + path + "/" + child.identity,
        );
        continue;
      }
      visit(child, match, path + "/" + child.identity);
    }
  };
  if (actual.type !== "COMPONENT_SET")
    problems.push("Pending recipe asset is not a native component set");
  for (const variant of actual.variants) {
    if (!variant.variantId) {
      problems.push("Unowned or incompletely tagged variant " + variant.nodeId);
      continue;
    }
    if (seenVariants.has(variant.variantId))
      problems.push("Duplicate managed variant " + variant.variantId);
    seenVariants.add(variant.variantId);
    const source = target.variants.find((v) => v.id === variant.variantId);
    if (!source) {
      problems.push(
        "Pending native variant is absent from target " + variant.variantId,
      );
      continue;
    }
    visit(variant.root, source.root, variant.variantId, true);
  }
  return [...new Set(problems)];
}
export function recoveryDecision(input: {
  entry: Entry;
  baseline?: RecordEntry;
  actualSnapshot: string | null;
  nodeId: string | null;
  partial?: PartialRecipe;
  baselineRelease?: string;
  targetRelease?: string;
}): RecoveryDecision {
  const { entry, baseline, actualSnapshot, nodeId } = input;
  const blocked = (reason: string): RecoveryDecision => ({
    status: "blocked",
    reason,
    preserveIds: [],
  });
  if (!baseline)
    return blocked("No saved managed baseline; manual recovery is required.");
  let previous: any, next: any;
  try {
    previous = JSON.parse(baseline.definition);
    next = JSON.parse(entry.definition);
  } catch {
    return blocked(
      "Invalid source or baseline definition; preserve the native assets.",
    );
  }
  if (previous.pending !== true)
    return {
      status: "not-pending",
      reason: "An applied asset follows ordinary three-way update rules.",
      preserveIds: [],
    };
  if (!nodeId || !actualSnapshot)
    return blocked(
      "Managed pending asset is missing; do not create an implicit replacement.",
    );
  if (nodeId !== baseline.nodeId)
    return blocked(
      "Pending native asset identity differs from the saved ledger.",
    );
  if (actualSnapshot !== baseline.snapshot)
    return blocked(
      "Native pending asset differs from its saved partial snapshot; local edits must be reviewed.",
    );
  if (
    previous.id !== next.id ||
    previous.package !== next.package ||
    canonical(previous.source ?? null) !== canonical(next.source ?? null)
  )
    return blocked(
      "Pending source identity changed; explicit migration is required.",
    );
  if (
    input.baselineRelease &&
    input.targetRelease &&
    input.baselineRelease !== input.targetRelease
  )
    return blocked(
      "Pending source release changed; review an explicit migration before resuming.",
    );
  if (entry.kind === "recipe") {
    if (!input.partial)
      return blocked(
        "Native partial recipe evidence is required before resuming.",
      );
    if (input.partial.nodeId !== nodeId)
      return blocked(
        "Partial recipe evidence belongs to a different native asset.",
      );
    const problems = partialRecipeProblems(input.partial, next);
    if (problems.length) return blocked(problems.join(" "));
    const ids: string[] = [nodeId];
    const visit = (node: PartialLayer) => {
      ids.push(node.nodeId);
      node.children.forEach(visit);
    };
    input.partial.variants.forEach((v) => visit(v.root));
    return {
      status: "resume",
      reason:
        "Saved plugin-owned partial state matches the target; resume in place using stable variant/layer tags.",
      preserveIds: [...new Set(ids)],
    };
  }
  // Non-recipe pending records must still retain their complete source definition.
  const strip = (value: any) => {
    const { pending, rendererRevision, ...rest } = value;
    return rest;
  };
  if (canonical(strip(previous)) !== canonical(strip(next)))
    return blocked(
      "Pending source definition changed; explicit recovery review is required.",
    );
  return {
    status: "resume",
    reason:
      "Saved pending source and actual snapshot match; resume the existing managed identity.",
    preserveIds: [nodeId],
  };
}
