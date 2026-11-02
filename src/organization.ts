import type { Bundle } from "./schema";
import { read, write } from "./metadata";
import { canonical, type RecordEntry } from "./plan";

/** Apply browsing names independently of source rendering. Never adopt unrelated drift. */
export async function organizeComponentNames(
  api: Pick<PluginAPI, "getNodeByIdAsync">,
  bundle: Bundle,
  index: {
    assets: Record<string, { id: string; kind: string }>;
    sections?: Record<string, string>;
  },
) {
  const report = {
    renamed: 0,
    alreadyOrganized: 0,
    conflicts: [] as string[],
    errors: [] as string[],
    mutatedNodeIds: [] as string[],
  };
  const changes: {
    node: any;
    raw: string;
    baseline: RecordEntry;
    name: string;
    category: string;
    definition: any;
    savedSnapshot: any;
  }[] = [];
  for (const recipe of bundle.recipes) {
    if (!recipe.assetName || !recipe.libraryCategory) continue;
    const ref = index.assets["recipe:" + recipe.id];
    const node = ref ? await api.getNodeByIdAsync(ref.id) : null;
    if (!node || node.type !== "COMPONENT_SET") {
      report.conflicts.push(
        recipe.id +
          ": existing component set is missing; run a reviewed library update first.",
      );
      continue;
    }
    const raw = read(node, "applied");
    if (!raw) {
      report.conflicts.push(recipe.id + ": saved sync baseline is missing.");
      continue;
    }
    const baseline = JSON.parse(raw) as RecordEntry;
    const definition = JSON.parse(baseline.definition);
    const savedSnapshot = JSON.parse(baseline.snapshot);
    if (
      baseline.nodeId !== node.id ||
      definition.id !== recipe.id ||
      definition.name !== recipe.name ||
      !savedSnapshot.name
    ) {
      report.conflicts.push(
        recipe.id + ": saved component identity differs; preserved for review.",
      );
      continue;
    }
    if (node.name !== savedSnapshot.name && node.name !== recipe.assetName) {
      report.conflicts.push(
        recipe.id + ": component was locally renamed; preserved for review.",
      );
      continue;
    }
    changes.push({
      node,
      raw,
      baseline,
      name: recipe.assetName,
      category: recipe.libraryCategory,
      definition,
      savedSnapshot,
    });
  }
  // Validate every name before changing the first one. Recovery history is owned by the caller.
  if (report.conflicts.length) return report;
  for (const change of changes) {
    if (read(change.node, "applied") !== change.raw)
      throw Error(
        "Component baseline changed during organization: " + change.node.id,
      );
    if (
      change.node.name !== change.savedSnapshot.name &&
      change.node.name !== change.name
    )
      throw Error(
        "Component name changed during organization: " + change.node.id,
      );
    let metadataChanged = false;
    // Keep a bounded per-component recovery record as well as the caller's history version.
    if (!read(change.node, "organization-before")) {
      write(
        change.node,
        "organization-before",
        JSON.stringify({ name: change.node.name, applied: change.raw }),
      );
      metadataChanged = true;
    }
    if (change.node.name === change.name) report.alreadyOrganized++;
    else {
      change.node.name = change.name;
      report.renamed++;
      report.mutatedNodeIds.push(change.node.id);
    }
    change.savedSnapshot.name = change.name;
    change.definition.assetName = change.name;
    change.definition.libraryCategory = change.category;
    // Patch only the name in the OLD snapshot. Current styling, text, geometry,
    // overrides and metadata are deliberately never captured as a new baseline.
    const next = JSON.stringify({
      ...change.baseline,
      definition: canonical(change.definition),
      snapshot: canonical(change.savedSnapshot),
    });
    write(change.node, "applied", next);
    if (
      (metadataChanged || next !== change.raw) &&
      !report.mutatedNodeIds.includes(change.node.id)
    )
      report.mutatedNodeIds.push(change.node.id);
  }
  for (const recipe of bundle.recipes) {
    if (!recipe.libraryCategory) continue;
    const family = recipe.name.split("/")[0];
    const id = index.sections?.["components/" + family];
    if (!id || report.mutatedNodeIds.includes(id)) continue;
    const section = await api.getNodeByIdAsync(id);
    if (
      section?.type === "SECTION" &&
      section.name !== `${recipe.libraryCategory} / ${family}`
    ) {
      section.name = `${recipe.libraryCategory} / ${family}`;
      report.mutatedNodeIds.push(section.id);
    }
  }
  return report;
}
