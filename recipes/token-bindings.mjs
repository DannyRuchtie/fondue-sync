/** Exact, role-aware geometry bindings for every reviewed native recipe.
 * Published Fondue tokens stay authoritative. Missing constants become explicitly
 * provenance-labelled native variables; no exported CSS token is invented.
 */
const roles = {
  spacing: { prefix: "spacing-", scope: "GAP" },
  radius: { prefix: "border-radius-", scope: "CORNER_RADIUS" },
  "border-width": { prefix: "border-width-", scope: "STROKE_FLOAT" },
};
const same = (a, b) =>
  typeof a === "number" && typeof b === "number" && Object.is(a, b);
const numberKey = (value) =>
  String(value).replace("-", "minus-").replace(".", "-point-");
const canonical = (value) => JSON.stringify(value);
export function augmentTokenBindings(bundle) {
  // ESM recipe modules are cached across deterministic rebuilds in the same process.
  // Never attach generated bindings to those imported source definition objects.
  bundle.recipes = structuredClone(bundle.recipes);
  if (bundle.examples) bundle.examples = structuredClone(bundle.examples);
  const byId = new Map(bundle.tokens.map((token) => [token.id, token]));
  const resolve = (id, seen = new Set()) => {
    if (seen.has(id)) return undefined;
    seen.add(id);
    const token = byId.get(id);
    const value = token?.values?.Value ?? token?.values?.Light;
    if (value?.alias) return resolve(value.alias, seen);
    return value;
  };
  const constants = new Map(
      bundle.tokens
        .filter(
          (token) =>
            token.provenance?.origin === "reviewed-native-recipe-constant",
        )
        .map((token) => [token.id, token]),
    ),
    exceptions = [],
    counts = {
      layers: 0,
      existingBindings: 0,
      addedReleasedBindings: 0,
      addedConstantBindings: 0,
      framePaddingBindings: 0,
      gapBindings: 0,
      radiusBindings: 0,
      borderWidthBindings: 0,
    };
  const sources = new Set();
  const constant = (role, value, context) => {
    const id = `component-constant-${role}-${numberKey(value)}`;
    let token = byId.get(id);
    if (!token) {
      token = {
        id,
        name: `component-constants/${role}/${String(value)}`,
        type: "FLOAT",
        collection: "Primitives",
        values: { Value: value },
        css: `${value}px`,
        scopes: [roles[role].scope],
        provenance: {
          origin: "reviewed-native-recipe-constant",
          role,
          value,
          unit: "px",
          definitionInputs: "provenance.definitionInputs.recipes",
          definitionNote:
            "A source-controlled native recipe literal or computed geometry result. This is not an exported Fondue CSS variable.",
          sourceFiles: [],
          examples: [],
          occurrences: 0,
        },
      };
      bundle.tokens.push(token);
      byId.set(id, token);
    }
    constants.set(id, token);
    token.provenance ??= {
      origin: "reviewed-native-recipe-constant",
      sourceFiles: [],
      examples: [],
      occurrences: 0,
    };
    token.provenance.occurrences++;
    if ((token.provenance.examples ??= []).length < 3)
      token.provenance.examples.push({ path: context.path, value, role });
    token.provenance.sourceFiles = [
      ...new Set([...token.provenance.sourceFiles, ...(context.source ?? [])]),
    ].sort();
    return id;
  };
  function bind(node, field, role, value, context) {
    if (!Number.isFinite(value)) {
      exceptions.push({
        path: context.path,
        field,
        role,
        value: String(value),
        reason:
          "Non-finite geometry cannot be represented by a native FLOAT variable.",
      });
      return;
    }
    node.bindings ??= {};
    if (node.bindings[field]) {
      counts.existingBindings++;
      return;
    }
    const candidates = bundle.tokens
      .filter(
        (token) =>
          token.type === "FLOAT" &&
          token.id.startsWith(roles[role].prefix) &&
          same(resolve(token.id), value),
      )
      .sort((a, b) => a.id.localeCompare(b.id, "en"));
    const id = candidates[0]?.id ?? constant(role, value, context);
    node.bindings[field] = id;
    if (candidates.length) counts.addedReleasedBindings++;
    else counts.addedConstantBindings++;
    if (field.startsWith("padding")) counts.framePaddingBindings++;
    else if (field === "itemSpacing") counts.gapBindings++;
    else if (field === "cornerRadius") counts.radiusBindings++;
    else if (field === "strokeWeight") counts.borderWidthBindings++;
  }
  function visit(node, context) {
    counts.layers++;
    const here = { ...context, path: context.path + "/" + node.id };
    if (node.kind === "frame") {
      for (const field of [
        "paddingTop",
        "paddingRight",
        "paddingBottom",
        "paddingLeft",
      ])
        bind(node, field, "spacing", node[field] ?? node.padding ?? 0, here);
      bind(node, "itemSpacing", "spacing", node.gap ?? 0, here);
    }
    // Ellipses, vectors, icon instances and composed instances have no independent
    // cornerRadius property. Circle/arc and source-component geometry is retained.
    if (node.kind === "frame" || node.kind === "rectangle")
      bind(node, "cornerRadius", "radius", node.radius ?? 0, here);
    if (
      node.radius !== undefined &&
      !["frame", "rectangle"].includes(node.kind)
    ) {
      exceptions.push({
        path: here.path,
        field: "radius",
        value: node.radius,
        reason:
          "Not an independent native corner property on " +
          node.kind +
          "; its arc/vector/source component already defines the geometry.",
        classification: "not-applicable",
      });
    }
    if (
      node.stroke ||
      node.bindings?.strokes ||
      node.strokeWeight !== undefined ||
      node.strokeWidth !== undefined
    )
      bind(
        node,
        "strokeWeight",
        "border-width",
        node.strokeWeight ?? node.strokeWidth ?? 1,
        here,
      );
    for (const child of node.children ?? []) visit(child, here);
  }
  for (const recipe of bundle.recipes) {
    recipe.source?.forEach((source) => sources.add(source));
    for (const variant of recipe.variants)
      visit(variant.root, {
        path: `${recipe.id}/${variant.id}`,
        source: recipe.source ?? [],
      });
  }
  for (const example of bundle.examples ?? [])
    visit(example.root, {
      path: `example:${example.id}`,
      source: ["recipes/examples.mjs"],
    });
  const derived = [...constants.values()].sort((a, b) =>
    a.id.localeCompare(b.id, "en"),
  );
  // The native sync engine can display the provenance distinction directly, and
  // bundle hashes cover every derived value and every resulting binding.
  bundle.provenance ??= {};
  bundle.provenance.geometryBindingPolicy = {
    version: 1,
    matching:
      "Exact value in the same spacing/radius/border-width category; explicit semantic bindings preserved.",
    derivedVariables: derived.map((token) => token.id),
    constantOrigin:
      "Reviewed source-controlled native recipe definitions, not additional exported upstream CSS variables.",
  };
  const report = {
    release: bundle.release,
    policy: bundle.provenance.geometryBindingPolicy,
    counts: {
      ...counts,
      derivedVariables: derived.length,
      exceptions: exceptions.filter(
        (e) => e.classification !== "not-applicable",
      ).length,
      notApplicable: exceptions.filter(
        (e) => e.classification === "not-applicable",
      ).length,
    },
    derivedVariables: derived.map((token) => ({
      id: token.id,
      value: token.values.Value,
      css: token.css,
      provenance: token.provenance,
    })),
    unboundExceptions: exceptions,
    limitations: [
      "Native variables do not support arithmetic expressions. A computed source geometry result such as radius=3px is a separately editable, provenance-labelled constant; editing a different input variable does not recompute it until the repository bundle is rebuilt.",
      "Fixed width/height, vector path coordinates and ellipse arc geometry are preserved source geometry; this pass binds spacing, visible border width and independent corner radii.",
    ],
  };
  bundle.tokenBindingCoverage = report;
  return report;
}
export default augmentTokenBindings;
