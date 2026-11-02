import policies from "../recipes/composition-policies.json" with { type: "json" };
const normalize = (packageName) =>
  packageName.replace(/^@frontify\/fondue\//, "");
export function compositionOverview(
  bundle,
  familyPolicies = policies.families,
) {
  const walk = (node, path = "", rows = []) => {
    const current = path + "/" + node.id;
    if (node.contentSlot)
      rows.push({ path: current, name: node.contentSlot.name });
    for (const child of node.children ?? []) walk(child, current, rows);
    return rows;
  };
  const inventory = new Map(
    bundle.inventory.map((entry) => [
      normalize(entry.package) + ":" + entry.name.split("/")[0],
      entry,
    ]),
  );
  const keys = new Set([...inventory.keys(), ...Object.keys(familyPolicies)]);
  for (const recipe of bundle.recipes) {
    const pkg = normalize(recipe.package);
    if (["components", "charts", "rte"].includes(pkg))
      keys.add(pkg + ":" + recipe.name.split("/")[0]);
  }
  return [...keys]
    .map((key) => {
      const [pkg, name] = key.split(":");
      return {
        key,
        sourcePresent: inventory.has(key),
        entry: inventory.get(key) ?? { name, package: pkg },
      };
    })
    .map(({ entry, key, sourcePresent }) => {
      const family = entry.name.split("/")[0];
      const policy = familyPolicies[key];
      const matches = bundle.recipes.filter(
        (r) =>
          normalize(r.package) === normalize(entry.package) &&
          r.name.split("/")[0] === family,
      );
      const slots = new Map();
      for (const recipe of matches)
        for (const variant of recipe.variants)
          for (const region of walk(variant.root))
            slots.set(recipe.id + region.path, {
              recipeId: recipe.id,
              component: recipe.name,
              ...region,
            });
      const available = [...slots.values()];
      const covered = new Set(available.map((slot) => slot.recipeId));
      const state = !sourcePresent
        ? "Not in source"
        : !policy
          ? "Needs review"
          : available.length
            ? policy.requiredRecipes?.length &&
              policy.requiredRecipes.every((id) => covered.has(id))
              ? "Available"
              : "Partly available"
            : ["fixed", "code-only", "data-driven"].includes(policy.mode)
              ? "No slot planned"
              : "Needs slots";
      return {
        key,
        name: entry.name,
        package: normalize(entry.package),
        mode: policy?.mode ?? "review",
        state,
        regions: policy?.regions ?? [],
        reason:
          policy?.reason ??
          "New or unclassified source family: review its anatomy and content ownership.",
        slots: available,
        recipeIds: matches.map((r) => r.id),
      };
    })
    .sort(
      (a, b) =>
        a.package.localeCompare(b.package) || a.name.localeCompare(b.name),
    );
}
export function compositionMarkdown(rows) {
  return (
    "# Component composition overview\n\nGenerated from the pinned source inventory, authored recipes and `recipes/composition-policies.json`. Rebuild to discover new source families. Recommendations are not approval or live Figma verification.\n\n| Component | Approach | Candidate regions | Generator status |\n|---|---|---|---|\n" +
    rows
      .map(
        (r) =>
          `| ${r.package} / ${r.name} | ${r.mode} | ${r.regions.join(", ") || "—"} | ${r.state} |`,
      )
      .join("\n") +
    "\n\nSurface, SegmentedControl and Table include native slots. Table columns require coordinated edits; the plugin composition actions assist with those. Existing sample components retain their identities. Other candidate regions remain a backlog, not an implemented capability.\n"
  );
}
