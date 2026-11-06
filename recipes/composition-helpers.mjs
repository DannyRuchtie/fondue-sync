/** Source-derived, additive composition recipes. No existing mains are reparented. */
export const clone = (value) => structuredClone(value);
export const variant = (props, root) => ({
  id: Object.entries(props)
    .map(([key, value]) => `${key}=${value}`)
    .join(";"),
  props: Object.fromEntries(
    Object.entries(props).map(([key, value]) => [key, String(value)]),
  ),
  root,
});
export const frame = (id, children = [], extra = {}) => ({
  id,
  name: id,
  kind: "frame",
  layout: "VERTICAL",
  gap: 0,
  padding: 0,
  primaryAlign: "MIN",
  counterAlign: "MIN",
  children,
  ...extra,
});
export const region = (id, name, children = [], extra = {}, limits = {}) =>
  frame(id, children, {
    contentSlot: {
      id,
      name,
      description: `Add, remove and arrange ${name.toLowerCase()} here. Keep nested library components linked.`,
      ...limits,
    },
    ...extra,
  });
export function reference(id, recipe, props = {}, extra = {}) {
  const match = recipe.variants.find((v) =>
    Object.entries(props).every(
      ([key, value]) => v.props[key] === String(value),
    ),
  );
  if (!match)
    throw Error(
      `No composition default matches ${recipe.id}: ${JSON.stringify(props)}`,
    );
  return {
    id,
    name: id,
    kind: "componentInstance",
    recipeId: recipe.id,
    variantProps: clone(match.props),
    ...extra,
  };
}
export function derived(source, id, name, transform, limitations = []) {
  return {
    id,
    name,
    package: source.package,
    source: clone(source.source),
    status: "partial",
    limitations: [
      "Additive native-slot composition; the original specimen retains its identities and overrides.",
      ...limitations,
    ],
    variants: source.variants.map((v) => ({
      ...clone(v),
      root: transform(clone(v.root), v.props),
    })),
  };
}
export function find(recipes, id) {
  const result = recipes.find((recipe) => recipe.id === id);
  if (!result) throw Error("Missing source composition part: " + id);
  return result;
}
export function walk(root, visit) {
  visit(root);
  for (const child of root.children ?? []) walk(child, visit);
  return root;
}
