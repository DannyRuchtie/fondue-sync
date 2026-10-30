import reviewed from "./image-migration-approvals.json";
import { canonical } from "./plan";
import { imageSha256 } from "./images";
import { read, write } from "./metadata";
import { snapshot, normalizeSavedSnapshot } from "./snapshot";
import type { Recipe } from "./schema";
export type ImageMigrationApproval = {
  id: string;
  beforeSha256: string;
  afterSha256: string;
  removals: {
    variantId: string;
    path: string;
    kind: string;
    imageRootPath: string;
  }[];
};
/** Exact source hash; renderer revisions and interrupted-import marker are separate metadata. */
export function imageMigrationSourceHash(value: any): string {
  const source = { ...value };
  delete source.rendererRevision;
  delete source.pending;
  const text = canonical(source),
    bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let cp = text.codePointAt(i)!;
    if (cp > 0xffff) i++;
    if (cp >= 0xd800 && cp <= 0xdfff) cp = 0xfffd;
    if (cp < 128) bytes.push(cp);
    else if (cp < 2048) bytes.push(192 | (cp >> 6), 128 | (cp & 63));
    else if (cp < 65536)
      bytes.push(224 | (cp >> 12), 128 | ((cp >> 6) & 63), 128 | (cp & 63));
    else
      bytes.push(
        240 | (cp >> 18),
        128 | ((cp >> 12) & 63),
        128 | ((cp >> 6) & 63),
        128 | (cp & 63),
      );
  }
  return imageSha256(new Uint8Array(bytes));
}
export function approvedImageMigration(
  previous: any,
  next: any,
  approvals: ImageMigrationApproval[] = reviewed.approvals,
): ImageMigrationApproval | undefined {
  if (!approvals.some((a) => a.id === previous.id && a.id === next.id))
    return undefined;
  const before = imageMigrationSourceHash(previous),
    after = imageMigrationSourceHash(next);
  return approvals.find(
    (a) =>
      a.id === previous.id &&
      a.id === next.id &&
      a.beforeSha256 === before &&
      a.afterSha256 === after,
  );
}
/** Filter only the exact reviewed structural-removal messages. General migration checks remain conservative. */
export function imageMigrationProblems(
  previous: any,
  next: any,
  problems: { code: string; message: string }[],
  approvals: ImageMigrationApproval[] = reviewed.approvals,
) {
  const approval = approvedImageMigration(previous, next, approvals);
  if (!approval) return problems;
  const allowed = new Set(approval.removals.map((r) => r.variantId + r.path));
  return problems.filter(
    (p) =>
      p.code !== "layer-path" ||
      ![...allowed].some(
        (path) =>
          p.message ===
          `Layer removal or reparenting requires explicit migration: ${path}`,
      ),
  );
}
const nativeType: Record<string, string> = {
  frame: "FRAME",
  rectangle: "RECTANGLE",
  ellipse: "ELLIPSE",
  text: "TEXT",
  componentInstance: "INSTANCE",
  instance: "INSTANCE",
  svg: "FRAME",
};
function sourceAt(recipe: Recipe, variantId: string, path: string) {
  const variant = recipe.variants.find((v) => v.id === variantId);
  let node: any = variant?.root;
  const parts = path.split("/").filter(Boolean);
  if (node?.id !== parts[0]) return;
  for (const part of parts.slice(1))
    node = node?.children?.find((n: any) => n.id === part);
  return node;
}
function nativeAt(set: any, variantId: string, path: string) {
  let node = set.children.find((v: any) => read(v, "variant") === variantId);
  for (const [i, part] of path.split("/").filter(Boolean).entries()) {
    if (i === 0 && node && read(node, "identity") === part) continue;
    node = node?.children?.find((n: any) => read(n, "identity") === part);
  }
  return node;
}
function validateOwned(node: any, source: any) {
  if (
    !node ||
    !source ||
    read(node, "identity") !== source.id ||
    node.type !== nativeType[source.kind]
  )
    throw Error("Reviewed image removal source identity/type differs");
  if (node.type === "INSTANCE") return; // Descendants remain owned by their linked main, which is never removed.
  const children = node.children ?? [],
    expected = source.children ?? [];
  if (children.length !== expected.length)
    throw Error("Foreign or missing child inside reviewed image geometry");
  for (const child of expected) {
    const matching = children.filter(
      (n: any) => read(n, "identity") === child.id,
    );
    if (matching.length !== 1)
      throw Error("Foreign/duplicate identity inside reviewed image geometry");
    validateOwned(matching[0], child);
  }
}
/** Synchronous ownership preflight used while the engine inspects all planned updates. */
export function validateImageMigrationOwnership(
  set: any,
  previous: Recipe,
  next: Recipe,
  approvals: ImageMigrationApproval[] = reviewed.approvals,
): void {
  const approval = approvedImageMigration(previous, next, approvals);
  if (!approval) return;
  for (const removal of approval.removals) {
    const root = sourceAt(next, removal.variantId, removal.imageRootPath);
    if (
      !root?.imageAssetId ||
      !removal.path.startsWith(removal.imageRootPath + "/")
    )
      throw Error("Reviewed removal falls outside its approved image root");
  }
  for (const removal of approval.removals.filter(
    (r) =>
      !approval.removals.some(
        (parent) =>
          parent.variantId === r.variantId &&
          r.path.startsWith(parent.path + "/"),
      ),
  ))
    validateOwned(
      nativeAt(set, removal.variantId, removal.path),
      sourceAt(previous, removal.variantId, removal.path),
    );
}
/** Per-asset recoverable migration, not an atomic canvas transaction. Every canvas removal
 * follows an exact baseline guard and is checkpointed. A crash before its checkpoint
 * fails closed on drift; it never silently adopts unexplained changes. No public mains
 * or image-root nodes are removed. Return every removed descendant ID for native audits.
 */
export async function applyApprovedImageMigration(
  api: PluginAPI,
  set: any,
  next: Recipe,
  checkpoint: (pending: Recipe) => Promise<void>,
  approvals: ImageMigrationApproval[] = reviewed.approvals,
): Promise<string[]> {
  const raw = read(set, "applied");
  if (!raw) return [];
  const saved = JSON.parse(raw),
    previous = JSON.parse(saved.definition),
    stateRaw = read(set, "image-migration-state");
  let state: any = stateRaw ? JSON.parse(stateRaw) : null;
  let approval = approvedImageMigration(previous, next, approvals);
  if (state) {
    approval = approvals.find(
      (a) =>
        a.id === next.id &&
        a.beforeSha256 === state.beforeSha256 &&
        a.afterSha256 === state.afterSha256 &&
        a.afterSha256 === imageMigrationSourceHash(next),
    );
    if (
      !approval ||
      state.version !== 1 ||
      !previous.pending ||
      imageMigrationSourceHash(previous) !== approval.afterSha256
    )
      throw Error("Interrupted image migration source identity differs");
  }
  if (!approval) return [];
  if (
    saved.nodeId !== set.id ||
    (await snapshot(set)) !== normalizeSavedSnapshot(saved.snapshot)
  )
    throw Error("Image migration baseline drift; local edits preserved");
  const selected = approval;
  for (const removal of selected.removals) {
    const imageRoot = sourceAt(next, removal.variantId, removal.imageRootPath);
    if (
      !imageRoot?.imageAssetId ||
      !removal.path.startsWith(removal.imageRootPath + "/")
    )
      throw Error("Reviewed removal falls outside its approved image root");
  }
  const top = selected.removals.filter(
    (r) =>
      !selected.removals.some(
        (parent) =>
          parent.variantId === r.variantId &&
          r.path.startsWith(parent.path + "/"),
      ),
  );
  if (!state) {
    const removals = top.map((r) => {
      const node = nativeAt(set, r.variantId, r.path);
      validateOwned(node, sourceAt(previous, r.variantId, r.path));
      return { ...r, id: node.id };
    });
    state = {
      version: 1,
      id: selected.id,
      beforeSha256: selected.beforeSha256,
      afterSha256: selected.afterSha256,
      removals,
    };
    write(set, "image-migration-state", JSON.stringify(state));
  }
  if (
    state.removals.length !== top.length ||
    state.removals.some(
      (r: any) =>
        !top.some(
          (t) =>
            t.variantId === r.variantId &&
            t.path === r.path &&
            t.kind === r.kind &&
            t.imageRootPath === r.imageRootPath,
        ),
    )
  )
    throw Error("Interrupted removal journal differs from exact approval");
  const affected: string[] = [];
  const collect = (node: any) => {
    affected.push(node.id);
    for (const child of node.children ?? []) collect(child);
  };
  for (const removal of state.removals) {
    const node = await api.getNodeByIdAsync(removal.id);
    if (node) {
      if (
        nativeAt(set, removal.variantId, removal.path)?.id !== node.id ||
        node.type !== nativeType[removal.kind]
      )
        throw Error("Reviewed migration native path/type changed");
      collect(node);
      node.remove();
    }
    await checkpoint({ ...next, pending: true } as Recipe);
  }
  // A completed earlier import may retain a different sibling order after an
  // absolute child was appended later. Partial-prefix recovery is deliberately
  // positional, so align only this exact approved migration's COMPLETE owned tree.
  // Validate every identity/type/membership first; a missing/foreign child never
  // turns into authorization to adopt, delete or reconstruct anything.
  const permutations: { parent: any; children: any[] }[] = [];
  const inspectOrder = (node: any, definition: any, root = false) => {
    if (
      !node ||
      read(node, "identity") !== definition.id ||
      node.type !== (root ? "COMPONENT" : nativeType[definition.kind])
    )
      throw Error(
        "Approved image migration complete-tree identity/type differs",
      );
    if (node.type === "INSTANCE" || definition.kind === "svg") return;
    const children = node.children ?? [],
      expected = definition.children ?? [];
    if (children.length !== expected.length)
      throw Error(
        "Approved image migration requires complete owned child membership",
      );
    const ordered = expected.map((child: any) => {
      const matches = children.filter(
        (actual: any) => read(actual, "identity") === child.id,
      );
      if (matches.length !== 1)
        throw Error(
          "Approved image migration child identity is missing/foreign/duplicated",
        );
      inspectOrder(matches[0], child);
      return matches[0];
    });
    if (
      ordered.some(
        (child: any, index: number) => children[index].id !== child.id,
      )
    )
      permutations.push({ parent: node, children: ordered });
  };
  if (set.children.length !== next.variants.length)
    throw Error("Approved image migration variant membership differs");
  for (const variant of next.variants) {
    const matches = set.children.filter(
      (node: any) => read(node, "variant") === variant.id,
    );
    if (matches.length !== 1)
      throw Error("Approved image migration variant identity differs");
    inspectOrder(matches[0], variant.root, true);
  }
  for (const permutation of permutations) {
    for (const [index, child] of permutation.children.entries())
      permutation.parent.insertChild(index, child);
    affected.push(
      permutation.parent.id,
      ...permutation.children.map((child: any) => child.id),
    );
    await checkpoint({ ...next, pending: true } as Recipe);
  }
  return affected;
}
