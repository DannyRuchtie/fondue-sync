import categories from "./component-categories.json" with { type: "json" };

/** Classify by the source family, never by visual appearance or profile labels. */
export function componentCategory(recipe) {
  const pkg = recipe.package.replace(/^@frontify\/fondue[/-]/, "");
  if (pkg !== "components") return undefined;
  const family = recipe.name.split("/")[0];
  return (
    Object.entries(categories).find(([, families]) =>
      families.includes(family),
    )?.[0] ?? "Other"
  );
}

export function componentAssetName(recipe) {
  const category = componentCategory(recipe);
  return category ? `${category}/${recipe.name}` : recipe.name;
}
