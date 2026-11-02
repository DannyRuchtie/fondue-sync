import { validatedImageBytes } from "./images";
import type { Bundle, Layer, Recipe } from "./schema";
import { canonical } from "./plan";
export type MigrationProblem = { code: string; message: string };
/** Container recomposition may retire old anatomy only when a newly composed base control replaces it. */
export function compositionRemovedChildren(
  previous: Layer,
  next: Layer,
): Layer[] {
  if (previous.kind !== "frame" || next.kind !== "frame") return [];
  const introducedControl = (next.children ?? []).some((child) => {
    const canonicalReference = child.recipeId
      ? /^components[/:]/.test(child.recipeId)
      : Boolean(
          child.componentName && !/^Production/.test(child.componentName),
        );
    if (
      child.kind !== "componentInstance" ||
      !child.componentRole ||
      child.componentRole === "text" ||
      !canonicalReference
    )
      return false;
    const prior = (previous.children ?? []).find(
      (item) => item.id === child.id,
    );
    if (!prior || prior.kind !== "componentInstance") return true;
    const changedReference =
      (prior.recipeId || prior.componentName) &&
      canonical([prior.recipeId, prior.componentName]) !==
        canonical([child.recipeId, child.componentName]);
    return Boolean(
      changedReference || prior.componentRole !== child.componentRole,
    );
  });
  if (!introducedControl) return [];
  return (previous.children ?? []).filter(
    (child) =>
      [
        "instance",
        "componentInstance",
        "text",
        "rectangle",
        "ellipse",
      ].includes(child.kind) &&
      !(next.children ?? []).some((current) => current.id === child.id),
  );
}
/** Pure, read-only migration checks. Run for EVERY planned update before making any canvas mutation. */
export function migrationProblems(
  kind: string,
  previous: any,
  next: any,
): MigrationProblem[] {
  const errors: MigrationProblem[] = [];
  const problem = (code: string, message: string) =>
    errors.push({ code, message });
  if (kind === "token") {
    if (previous.type !== next.type)
      problem("token-type", `Variable type migration required: ${next.id}`);
    if (previous.collection !== next.collection)
      problem(
        "token-collection",
        `Variable collection migration required: ${next.id}`,
      );
  }
  if (kind === "style" && previous.type !== next.type)
    problem("style-type", `Style type migration required: ${next.id}`);
  if (kind === "icon" && previous.svg !== next.svg)
    problem(
      "icon-geometry",
      `SVG geometry migration required to preserve native vector identity: ${next.id}`,
    );
  if (kind === "example") {
    return migrationProblems(
      "recipe",
      { variants: [{ id: "example", root: previous.root }] },
      { variants: [{ id: "example", root: next.root }] },
    );
  }
  if (
    kind === "icon" &&
    canonical(previous.sizes ?? []) !== canonical(next.sizes ?? [])
  )
    problem(
      "icon-optics",
      "Optical SVG geometry changes require an explicit migration.",
    );
  if (kind !== "recipe") return errors;
  const collect = (layer: Layer, parent = ""): Map<string, Layer> => {
    const key = parent + "/" + layer.id;
    return new Map([
      [key, layer],
      ...(layer.children ?? []).flatMap((child) => [...collect(child, key)]),
    ]);
  };
  for (const oldVariant of previous.variants ?? []) {
    const target = (next as Recipe).variants.find(
      (v) => v.id === oldVariant.id,
    );
    if (!target) {
      problem(
        "variant-removal",
        `Variant removal requires explicit migration: ${oldVariant.id}`,
      );
      continue;
    }
    const oldLayers = collect(oldVariant.root),
      layers = collect(target.root);
    const compositionRoots =
      next.compositionPolicy === 1 &&
      typeof next.package === "string" &&
      next.package.includes("fondue-sync")
        ? [...oldLayers]
            .filter(
              ([key, prior]) =>
                key !== "/" + oldVariant.root.id &&
                ["frame", "text", "rectangle", "ellipse", "instance"].includes(
                  prior.kind,
                ) &&
                layers.get(key)?.kind === "componentInstance",
            )
            .map(([key]) => key)
        : [];
    if (
      next.compositionPolicy === 1 &&
      typeof next.package === "string" &&
      next.package.includes("fondue-sync")
    ) {
      for (const [path, prior] of oldLayers) {
        const current = layers.get(path);
        if (!current) continue;
        for (const child of compositionRemovedChildren(prior, current))
          compositionRoots.push(path + "/" + child.id);
      }
    }
    for (const [key, prior] of oldLayers) {
      if (
        compositionRoots.some(
          (root) => key === root || key.startsWith(root + "/"),
        )
      )
        continue;
      const layer = layers.get(key);
      if (!layer) {
        problem(
          "layer-path",
          `Layer removal or reparenting requires explicit migration: ${oldVariant.id}${key}`,
        );
        continue;
      }
      if (
        prior.contentSlot &&
        (!layer.contentSlot ||
          layer.contentSlot.id !== prior.contentSlot.id ||
          layer.contentSlot.name !== prior.contentSlot.name)
      )
        problem(
          "slot-migration",
          `Content slot removal or identity change requires explicit migration: ${oldVariant.id}${key}`,
        );
      if (
        !prior.contentSlot &&
        layer.contentSlot &&
        (prior.children?.length ?? 0) > 0
      )
        problem(
          "slot-adoption",
          `Existing content requires explicit slot migration to preserve overrides: ${oldVariant.id}${key}`,
        );
      if (layer.kind !== prior.kind)
        problem(
          "layer-type",
          `Layer type change requires explicit migration: ${oldVariant.id}${key}`,
        );
      if (prior.kind === "svg" && prior.svg !== layer.svg)
        problem(
          "svg-geometry",
          `SVG geometry change requires explicit migration: ${oldVariant.id}${key}`,
        );
      if (prior.kind === "instance" && prior.iconId !== layer.iconId)
        problem(
          "instance-source",
          `Nested icon component change requires explicit migration: ${oldVariant.id}${key}`,
        );
    }
  }
  return errors;
}
/** Reject invalid dependency graphs before any variable, style, or component shell exists. */
export function bundleProblems(bundle: Bundle): MigrationProblem[] {
  const errors: MigrationProblem[] = [];
  const problem = (code: string, message: string) =>
    errors.push({ code, message });
  const tokens = new Map(bundle.tokens.map((t) => [t.id, t])),
    styles = new Map(bundle.styles.map((t) => [t.id, t])),
    icons = new Set(bundle.icons.map((t) => t.id));
  for (const [kind, values] of Object.entries({
    token: bundle.tokens,
    style: bundle.styles,
    icon: bundle.icons,
    recipe: bundle.recipes,
  })) {
    const ids = values.map((v: any) => v.id);
    if (new Set(ids).size !== ids.length)
      problem(
        "duplicate-identity",
        `Duplicate ${kind} identity in release bundle.`,
      );
  }
  const imageAssets = new Map(
    (bundle.imageAssets ?? []).map((asset) => [asset.id, asset]),
  );
  if (imageAssets.size !== (bundle.imageAssets ?? []).length)
    problem("duplicate-image", "Duplicate offline image identity.");
  for (const asset of bundle.imageAssets ?? []) {
    try {
      validatedImageBytes(asset);
    } catch (error) {
      problem("invalid-image", String(error));
    }
  }
  const binding = (id: string, context: string) => {
    if (!tokens.has(id))
      problem("missing-binding", `Missing token ${id}: ${context}`);
  };
  for (const token of bundle.tokens) {
    const modes =
      token.collection === "Semantic" ? ["Light", "Dark"] : ["Value"];
    if (Object.keys(token.values).sort().join(",") !== modes.sort().join(","))
      problem("token-modes", `Unexpected variable modes: ${token.id}`);
    for (const value of Object.values(token.values))
      if (value && typeof value === "object" && "alias" in value) {
        const target = tokens.get(value.alias);
        if (!target)
          problem("missing-alias", `Missing alias ${value.alias}: ${token.id}`);
        else if (target.type !== token.type)
          problem(
            "alias-type",
            `Alias type differs: ${token.id} -> ${target.id}`,
          );
      }
  }
  const visitAlias = (id: string, stack: string[]) => {
    if (stack.includes(id)) {
      problem(
        "alias-cycle",
        `Cyclic token alias: ${[...stack, id].join(" -> ")}`,
      );
      return;
    }
    const token = tokens.get(id);
    if (!token) return;
    for (const value of Object.values(token.values))
      if (value && typeof value === "object" && "alias" in value)
        visitAlias(value.alias, [...stack, id]);
  };
  for (const token of bundle.tokens) visitAlias(token.id, []);
  for (const icon of bundle.icons)
    if (icon.defaultColorToken) {
      binding(icon.defaultColorToken, icon.id);
      if (tokens.get(icon.defaultColorToken)?.type !== "COLOR")
        problem(
          "icon-color-type",
          `Icon default paint must target COLOR: ${icon.id}`,
        );
    }
  for (const style of bundle.styles) {
    for (const id of Object.values(style.bindings ?? {}))
      binding(id as string, style.id);
    if (style.type === "TEXT")
      for (const [field, id] of Object.entries(style.bindings ?? {})) {
        const type = field === "fontFamily" ? "STRING" : "FLOAT";
        if (tokens.get(id as string)?.type !== type)
          problem(
            "typography-binding-type",
            `Text style ${style.id}/${field} must use ${type} variable.`,
          );
      }
    if (style.colorToken) binding(style.colorToken, style.id);
    for (const [index, map] of (style.effectBindings ?? []).entries())
      for (const [field, id] of Object.entries(map)) {
        binding(id as string, style.id + ":" + index + ":" + field);
        const token = tokens.get(id as string);
        if (token && token.type !== (field === "color" ? "COLOR" : "FLOAT"))
          problem(
            "effect-binding-type",
            `Wrong effect binding type: ${style.id}/${field}`,
          );
      }
  }
  const layer = (node: Layer, context: string) => {
    for (const field of [
      "layoutSizingHorizontal",
      "layoutSizingVertical",
    ] as const)
      if (
        node[field] !== undefined &&
        !["FIXED", "HUG", "FILL"].includes(node[field]!)
      )
        problem("layer-sizing", `Invalid ${field}: ${context}/${node.id}`);
    if (node.imageAssetId) {
      const asset = imageAssets.get(node.imageAssetId);
      if (!asset)
        problem(
          "missing-image",
          `Missing offline image ${node.imageAssetId}: ${context}/${node.id}`,
        );
      else if (node.imageAssetSha256 !== asset.sha256)
        problem(
          "image-digest",
          `Image reference digest mismatch: ${context}/${node.id}`,
        );
      if (!["frame", "rectangle"].includes(node.kind))
        problem(
          "image-layer",
          `Image paints require an editable frame/rectangle: ${context}/${node.id}`,
        );
      if (node.bindings?.fills || node.fill)
        problem(
          "image-fill-conflict",
          `Image layer also declares a solid fill: ${context}/${node.id}`,
        );
      if (
        node.imageScaleMode &&
        !["FILL", "FIT", "CROP", "TILE"].includes(node.imageScaleMode)
      )
        problem(
          "image-scale",
          `Invalid image scale mode: ${context}/${node.id}`,
        );
      if (node.imageScaleMode === "CROP" && !node.imageTransform)
        problem(
          "image-crop",
          `Explicit CROP image requires transform: ${context}/${node.id}`,
        );
      if (
        node.imageTransform &&
        (node.imageScaleMode !== "CROP" ||
          node.imageTransform.length !== 2 ||
          node.imageTransform.some(
            (row) =>
              row.length !== 3 || row.some((value) => !Number.isFinite(value)),
          ))
      )
        problem(
          "image-transform",
          `Invalid image crop transform: ${context}/${node.id}`,
        );
      if (
        node.imageScalingFactor !== undefined &&
        (node.imageScaleMode !== "TILE" ||
          !Number.isFinite(node.imageScalingFactor) ||
          node.imageScalingFactor <= 0)
      )
        problem(
          "image-tile",
          `Invalid image tile scale: ${context}/${node.id}`,
        );
    } else if (
      node.imageAssetSha256 ||
      node.imageScaleMode ||
      node.imageTransform ||
      node.imageScalingFactor !== undefined
    )
      problem(
        "missing-image",
        `Image options lack asset identity: ${context}/${node.id}`,
      );
    if ((bundle as any).typographyBindingCoverage && node.kind === "text") {
      const style = styles.get(node.textStyle ?? "");
      if (!style || style.type !== "TEXT")
        problem(
          "missing-shared-typography",
          `Text layer lacks shared source style: ${context}/${node.id}`,
        );
      for (const field of [
        "fontFamily",
        "fontSize",
        "fontWeight",
        "letterSpacing",
        ...(typeof style?.lineHeight === "number" ? ["lineHeight"] : []),
      ])
        if (!node.bindings?.[field])
          problem(
            "missing-typography-binding",
            `Text layer lacks ${field} binding: ${context}/${node.id}`,
          );
    }

    for (const id of Object.values(node.bindings ?? {}))
      binding(id, context + "/" + node.id);
    if (node.kind === "text")
      for (const field of [
        "fontFamily",
        "fontSize",
        "fontWeight",
        "lineHeight",
        "letterSpacing",
      ]) {
        const id = node.bindings?.[field];
        if (
          id &&
          tokens.get(id)?.type !== (field === "fontFamily" ? "STRING" : "FLOAT")
        )
          problem(
            "typography-binding-type",
            `Text layer ${context}/${node.id}/${field} has wrong variable type.`,
          );
      }
    if (node.iconColor) binding(node.iconColor, context + "/" + node.id);
    for (const rule of node.svgPaintBindings ?? []) {
      binding(rule.tokenId, context + "/" + node.id);
      if (tokens.get(rule.tokenId)?.type !== "COLOR")
        problem(
          "svg-color-type",
          `SVG paint binding must target a COLOR variable: ${context}/${node.id}`,
        );
      if (!/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(rule.color))
        problem(
          "svg-color-format",
          `Invalid SVG source paint selector: ${context}/${node.id}`,
        );
    }
    if (node.focusRing) {
      binding(node.focusRing.inner, context + "/" + node.id);
      binding(node.focusRing.outer, context + "/" + node.id);
    }
    if (node.kind === "componentInstance") {
      const candidates = bundle.recipes.filter((r) =>
        node.recipeId
          ? r.id === node.recipeId
          : r.name.split("/")[0] === node.componentName,
      );
      const choices = candidates
        .flatMap((r) => r.variants.map((v) => ({ recipe: r, variant: v })))
        .filter(({ variant: v }) =>
          Object.entries(node.variantProps ?? {}).every(
            ([key, value]) => v.props[key] === value,
          ),
        );
      if (choices.length && node.instanceOverrides) {
        const anatomy: { path: string; source: Layer }[] = [];
        const walk = (source: Layer, parent = "") => {
          const path = parent + "/" + source.id;
          anatomy.push({ path, source });
          for (const child of source.children ?? []) walk(child, path);
        };
        walk(choices[0].variant.root);
        for (const [key, override] of Object.entries(node.instanceOverrides)) {
          const matches =
            key === "__root__"
              ? [anatomy[0]]
              : anatomy.filter(
                  ({ path }) => path === key || path.endsWith("/" + key),
                );
          if (matches.length !== 1) {
            problem(
              "instance-override-path",
              `Override must target one existing anatomy path: ${context}/${node.id}/${key}`,
            );
            continue;
          }
          if (
            [
              "id",
              "kind",
              "name",
              "children",
              "componentName",
              "recipeId",
              "variantProps",
              "instanceOverrides",
            ].some((field) => field in override)
          ) {
            problem(
              "instance-override-structure",
              `Instance overrides cannot change source structure: ${context}/${node.id}/${key}`,
            );
            continue;
          }
          layer(
            { ...matches[0].source, ...override, children: [] },
            context + "/" + node.id + "/override",
          );
        }
      }
      if (!choices.length)
        problem(
          "missing-component-instance",
          `No native component/variant matches ${node.recipeId ?? node.componentName}: ${context}/${node.id}`,
        );
      else if (
        node.text !== undefined ||
        Object.keys(node.textOverrides ?? {}).length
      ) {
        const textPaths = (n: Layer, parent = ""): string[] => [
          ...(n.kind === "text" ? [parent + "/" + n.id] : []),
          ...(n.children ?? []).flatMap((c) =>
            textPaths(c, parent + "/" + n.id),
          ),
        ];
        const paths = textPaths(choices[0].variant.root);
        if (node.text !== undefined && !paths.length)
          problem(
            "missing-instance-text",
            `Native component has no exposed text: ${context}/${node.id}`,
          );
        for (const key of Object.keys(node.textOverrides ?? {}))
          if (!paths.some((p) => p.endsWith("/" + key)))
            problem(
              "missing-instance-text",
              `No stable text property ${key}: ${context}/${node.id}`,
            );
      }
    }
    if (node.iconId && !icons.has(node.iconId))
      problem(
        "missing-icon",
        `Missing native icon ${node.iconId}: ${context}/${node.id}`,
      );
    if (node.textStyle && styles.get(node.textStyle)?.type !== "TEXT")
      problem(
        "missing-text-style",
        `Missing text style ${node.textStyle}: ${context}/${node.id}`,
      );
    if (node.effectStyle && styles.get(node.effectStyle)?.type !== "EFFECT")
      problem(
        "missing-effect-style",
        `Missing effect style ${node.effectStyle}: ${context}/${node.id}`,
      );
    if (node.contentSlot) {
      const slot = node.contentSlot;
      if (node.kind !== "frame" || !slot.id?.trim() || !slot.name?.trim())
        problem(
          "content-slot",
          `Content slot requires a frame and stable identity/name: ${context}/${node.id}`,
        );
      for (const value of [slot.minChildren, slot.maxChildren])
        if (value !== undefined && (!Number.isInteger(value) || value < 0))
          problem(
            "slot-limits",
            `Slot limits must be nonnegative integers: ${context}/${node.id}`,
          );
      if (
        slot.minChildren !== undefined &&
        slot.maxChildren !== undefined &&
        slot.minChildren > slot.maxChildren
      )
        problem(
          "slot-limits",
          `Slot minimum exceeds maximum: ${context}/${node.id}`,
        );
    }
    const children = node.children ?? [];
    if (new Set(children.map((c) => c.id)).size !== children.length)
      problem(
        "duplicate-layer",
        `Duplicate sibling identity: ${context}/${node.id}`,
      );
    children.forEach((child) => layer(child, context + "/" + node.id));
  };
  for (const recipe of bundle.recipes) {
    if (!recipe.variants.length)
      problem("empty-set", `Component set has no variants: ${recipe.id}`);
    if (
      new Set(recipe.variants.map((v) => v.id)).size !== recipe.variants.length
    )
      problem("duplicate-variant", `Duplicate variant identity: ${recipe.id}`);
    for (const variant of recipe.variants)
      layer(variant.root, recipe.id + "/" + variant.id);
  }
  for (const example of bundle.examples ?? [])
    layer(example.root, "example:" + example.id);
  const dependencyEdges = new Map<string, Set<string>>();
  for (const recipe of bundle.recipes) {
    const edges = new Set<string>();
    const inspect = (node: Layer) => {
      if (node.kind === "componentInstance") {
        const candidate = bundle.recipes.find((r) =>
          node.recipeId
            ? r.id === node.recipeId
            : r.name.split("/")[0] === node.componentName,
        );
        if (candidate) edges.add(candidate.id);
      }
      for (const child of node.children ?? []) inspect(child);
    };
    recipe.variants.forEach((v) => inspect(v.root));
    dependencyEdges.set(recipe.id, edges);
  }
  const completed = new Set<string>();
  const visitRecipe = (id: string, ancestors: string[]) => {
    if (ancestors.includes(id)) {
      problem(
        "component-cycle",
        `Cyclic native component dependency: ${[...ancestors, id].join(" -> ")}`,
      );
      return;
    }
    if (completed.has(id)) return;
    for (const child of dependencyEdges.get(id) ?? [])
      visitRecipe(child, [...ancestors, id]);
    completed.add(id);
  };
  for (const recipe of bundle.recipes) visitRecipe(recipe.id, []);
  return errors;
}
