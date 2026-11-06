import type { SyncEngine } from "./engine";
import type { Layer, Recipe } from "./schema";
import { read, write } from "./metadata";
import { canonical } from "./plan";
import { snapshot, normalizeSavedSnapshot } from "./snapshot";
import { bundleProblems } from "./preflight";
import { contentContainer } from "./slots";
import { inspectPartialRecipe, partialRecipeProblems } from "./recovery";
import policies from "../recipes/composition-policies.json";
type Node = any;

/** Install only missing compositions. Existing foundations, mains, pages and
 * baselines are reused as-is; the whole-file release/fingerprint never advances.
 * The caller must establish the ordinary recovery checkpoint before invoking.
 */
export async function installCompositions(
  engine: SyncEngine,
  progress?: (message: string) => void,
) {
  const report = {
    createdRecipeIds: [] as string[],
    resumedRecipeIds: [] as string[],
    reusedRecipeIds: [] as string[],
    createdNodeIds: [] as string[],
    errors: [] as string[],
    complete: false,
    globalFingerprintUnchanged: true,
  };
  const invalid = bundleProblems(engine.bundle);
  if (invalid.length) {
    report.errors = invalid.map((p) => p.message);
    return report;
  }
  const recipes = new Map(
    engine.bundle.recipes.map((recipe) => [recipe.id, recipe]),
  );
  const first = [
    "components:Flyout",
    "components:SegmentedControl",
    "components:Table",
  ];
  const rank = (key: string) => {
    const index = first.indexOf(key);
    return index < 0 ? first.length : index;
  };
  const ids = new Set<string>(
    Object.entries(policies.families)
      .sort(([a], [b]) => rank(a) - rank(b))
      .flatMap(([, policy]: [string, any]) => policy.requiredRecipes ?? []),
  );
  const dependencies = (root: Layer) => {
    if (root.recipeId) ids.add(root.recipeId);
    for (const child of root.children ?? []) dependencies(child);
  };
  let previous = -1;
  while (previous !== ids.size) {
    previous = ids.size;
    for (const id of ids) {
      const recipe = recipes.get(id);
      if (!recipe) throw Error("Missing composition definition: " + id);
      recipe.variants.forEach((v) => dependencies(v.root));
    }
  }
  const ordered: Recipe[] = [],
    visited = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    const recipe = recipes.get(id)!;
    const edges = new Set<string>();
    const walk = (root: Layer) => {
      if (root.recipeId) edges.add(root.recipeId);
      for (const child of root.children ?? []) walk(child);
    };
    recipe.variants.forEach((v) => walk(v.root));
    for (const edge of edges) visit(edge);
    ordered.push(recipe);
  };
  ids.forEach(visit);
  const targets: Array<{
    recipe: Recipe;
    asset: Node | null;
    pending: boolean;
  }> = [];
  const validateSlots = (node: Node, definition: Layer) => {
    const container = contentContainer(node, definition);
    if (
      definition.contentSlot &&
      (container.type !== "SLOT" ||
        container.name !== definition.contentSlot.name)
    )
      throw Error(
        "Existing composition is missing or has renamed a native slot: " +
          definition.contentSlot.name,
      );
    if (
      definition.kind === "componentInstance" ||
      definition.kind === "instance"
    )
      return;
    for (const child of definition.children ?? []) {
      const current = container.children?.find(
        (n: Node) => read(n, "identity") === child.id,
      );
      // Slot defaults are designer-editable and can differ; their presence is not adopted or reset.
      if (definition.contentSlot) continue;
      if (!current)
        throw Error("Existing composition anatomy is missing: " + child.id);
      validateSlots(current, child);
    }
  };
  try {
    for (const recipe of ordered) {
      const ref = engine.index.assets["recipe:" + recipe.id];
      const asset: Node = ref
        ? await engine.api.getNodeByIdAsync(ref.id)
        : null;
      if (ref && (!asset || asset.type !== "COMPONENT_SET"))
        throw Error(
          "Restore the missing managed component before installation: " +
            recipe.id,
        );
      let pending = false;
      if (asset) {
        if (
          JSON.parse(read(asset, "mapping") || "{}").id !==
          "recipe:" + recipe.id
        )
          throw Error("Managed source identity differs: " + recipe.id);
        const baseline = JSON.parse(read(asset, "applied") || "{}");
        const old = baseline.definition
          ? JSON.parse(baseline.definition)
          : null;
        if (
          !old ||
          baseline.nodeId !== asset.id ||
          old.id !== recipe.id ||
          old.package !== recipe.package ||
          canonical(old.source) !== canonical(recipe.source)
        )
          throw Error(
            "Managed component baseline/source differs: " + recipe.id,
          );
        pending = old?.pending === true;
        if (pending) {
          if (
            baseline.nodeId !== asset.id ||
            (await snapshot(asset)) !==
              normalizeSavedSnapshot(baseline.snapshot)
          )
            throw Error("A partial installation has local edits: " + recipe.id);
          const problems = partialRecipeProblems(
            inspectPartialRecipe(asset),
            recipe,
          );
          if (problems.length) throw Error(problems.join(" "));
        } else {
          for (const variant of recipe.variants) {
            const matches = asset.children.filter(
              (n: Node) => read(n, "variant") === variant.id,
            );
            if (matches.length > 1)
              throw Error(
                "Duplicate managed variant: " + recipe.id + " / " + variant.id,
              );
            const main = matches[0];
            if (!main || main.type !== "COMPONENT")
              throw Error(
                "Existing component needs a guarded update before installation: " +
                  recipe.id +
                  " / " +
                  variant.id,
              );
            validateSlots(main, variant.root);
          }
          report.reusedRecipeIds.push(recipe.id);
        }
      }
      if (!asset || pending) targets.push({ recipe, asset, pending });
    }
    const tokenIds = new Set<string>(),
      styleIds = new Set<string>(),
      iconIds = new Set<string>();
    const collect = (root: Layer) => {
      Object.values(root.bindings ?? {}).forEach((id) => tokenIds.add(id));
      if (root.iconColor) tokenIds.add(root.iconColor);
      if (root.focusRing) {
        tokenIds.add(root.focusRing.inner);
        tokenIds.add(root.focusRing.outer);
      }
      root.svgPaintBindings?.forEach((rule) => tokenIds.add(rule.tokenId));
      if (root.textStyle) styleIds.add(root.textStyle);
      if (root.effectStyle) styleIds.add(root.effectStyle);
      if (root.iconId) iconIds.add(root.iconId);
      for (const child of root.children ?? []) collect(child);
    };
    targets.forEach(({ recipe }) =>
      recipe.variants.forEach((variant) => collect(variant.root)),
    );
    for (const id of styleIds) {
      const ref = engine.index.assets["style:" + id],
        style = ref ? await engine.api.getStyleByIdAsync(ref.id) : null;
      if (!style) throw Error("Import the required style first: " + id);
    }
    for (const id of tokenIds) {
      const ref = engine.index.assets["token:" + id],
        token = ref
          ? await engine.api.variables.getVariableByIdAsync(ref.id)
          : null;
      if (!token) throw Error("Import the required variable first: " + id);
    }
    for (const id of iconIds) {
      const ref = engine.index.assets["icon:" + id],
        icon = ref ? await engine.api.getNodeByIdAsync(ref.id) : null;
      if (!icon || !["COMPONENT", "COMPONENT_SET"].includes(icon.type))
        throw Error("Import the required icon first: " + id);
    }
    for (const key of [
      "Library masters - Components",
      "Library masters - Rich text",
    ]) {
      if (engine.index.pages[key]) {
        const page = await engine.api.getNodeByIdAsync(engine.index.pages[key]);
        if (!page || page.type !== "PAGE")
          throw Error(
            "Restore the managed source page before installation: " + key,
          );
      }
    }
    if (targets.length) {
      const fontErrors = await engine.preflightFonts(progress);
      if (fontErrors.length) throw Error(fontErrors.join("\n"));
    }
  } catch (error) {
    report.errors.push(String(error));
    return report;
  }
  const entries = new Map(
    engine
      .entries()
      .filter(({ entry }) => entry.kind === "recipe")
      .map(({ entry }) => [entry.id, entry]),
  );
  const positions = new Map<
    string,
    { x: number; y: number; rowHeight: number; start: number; count: number }
  >();
  for (const target of targets) {
    const { recipe } = target;
    let asset = target.asset;
    const entry = entries.get("recipe:" + recipe.id)!;
    progress?.("Installing editable component: " + recipe.name);
    try {
      const key =
        "Library masters - " +
        (recipe.package.replace("@frontify/fondue/", "") === "rte"
          ? "Rich text"
          : "Components");
      const page = engine.index.pages[key]
        ? await engine.api.getNodeByIdAsync(engine.index.pages[key])
        : await engine.page(key);
      if (!page || page.type !== "PAGE") throw Error("Source page is missing.");
      if ("loadAsync" in page) await page.loadAsync();
      if (!positions.has(page.id)) {
        const start =
          Math.max(0, ...page.children.map((n: Node) => n.x + n.width)) + 160;
        positions.set(page.id, {
          x: start,
          y: 0,
          start,
          rowHeight: 0,
          count: 0,
        });
      }
      if (!asset) {
        const seed = engine.api.createComponent();
        page.appendChild(seed);
        seed.name = "State=Default";
        asset = engine.api.combineAsVariants([seed], page);
        write(seed, "variant", recipe.variants[0].id);
        await engine.checkpoint(
          {
            ...entry,
            definition: canonical({
              ...recipe,
              rendererRevision: engine.bundle.provenance.rendererRevision,
              pending: true,
              variants: [],
            }),
          },
          asset,
        );
        report.createdNodeIds.push(asset.id);
      }
      await engine.applyRecipe(recipe, asset);
      const position = positions.get(page.id)!;
      if (position.count && position.count % 3 === 0) {
        position.y += position.rowHeight + 160;
        position.x = position.start;
        position.rowHeight = 0;
      }
      asset.x = position.x;
      asset.y = position.y;
      position.x += asset.width + 160;
      position.rowHeight = Math.max(position.rowHeight, asset.height);
      position.count++;
      await engine.checkpoint(entry, asset);
      (target.pending ? report.resumedRecipeIds : report.createdRecipeIds).push(
        recipe.id,
      );
    } catch (error) {
      if (asset)
        try {
          await engine.checkpoint(
            {
              ...entry,
              definition: canonical({
                ...recipe,
                rendererRevision: engine.bundle.provenance.rendererRevision,
                pending: true,
              }),
            },
            asset,
          );
        } catch (checkpointError) {
          report.errors.push(
            "Could not record partial installation: " + String(checkpointError),
          );
        }
      report.errors.push(recipe.id + ": " + String(error));
      break;
    }
  }
  report.complete = report.errors.length === 0;
  return report;
}
