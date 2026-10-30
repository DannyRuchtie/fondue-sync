/** Group equal defaults at stable source paths; first group's public key remains compatible. */
export function componentPropertyGroups(recipe, iconDefault) {
  const paths = new Map();
  const add = (prefix, type, path, value, variantId) => {
    const identity = JSON.stringify([prefix, path]);
    let values = paths.get(identity);
    if (!values) {
      values = new Map();
      paths.set(identity, values);
    }
    const valueKey = JSON.stringify(value);
    let group = values.get(valueKey);
    if (!group) {
      group = { prefix, type, path, value, variantIds: [] };
      values.set(valueKey, group);
    }
    group.variantIds.push(variantId);
  };
  for (const variant of recipe.variants) {
    const walk = (node, parent = "") => {
      const path = parent + "/" + node.id;
      if (node.kind === "text")
        add("Text", "TEXT", path, node.text ?? "", variant.id);
      if (node.kind === "instance")
        add("Icon", "INSTANCE_SWAP", path, iconDefault(node), variant.id);
      for (const child of node.children ?? []) walk(child, path);
    };
    walk(variant.root);
  }
  return [...paths.values()].flatMap((values) =>
    [...values.values()].map((group, index) => ({
      ...group,
      collision: values.size > 1,
      label:
        group.prefix +
        " / " +
        group.path +
        (index
          ? " / Variant " + group.variantIds[0].replaceAll("#", "-hash-")
          : ""),
    })),
  );
}
export function sourceIconDefault(layer, icons) {
  const icon = icons.find((icon) => icon.id === layer.iconId),
    requested = layer.width ?? 24;
  const size = icon?.sizes?.length
    ? icon.sizes.some((item) => item.size === requested)
      ? requested
      : 24
    : "single";
  return layer.iconId + "@" + size;
}
export function augmentComponentPropertyPolicies(bundle) {
  const recipes = [];
  for (const recipe of bundle.recipes) {
    const groups = componentPropertyGroups(recipe, (layer) =>
      sourceIconDefault(layer, bundle.icons),
    );
    const collisions = groups.filter((group) => group.collision);
    if (collisions.length) {
      recipe.componentPropertyPolicy = 2;
      recipes.push({
        id: recipe.id,
        paths: [
          ...new Set(
            collisions.map((group) => group.prefix + " / " + group.path),
          ),
        ],
        groups: collisions.map(
          ({ prefix, path, variantIds, label, value }) => ({
            prefix,
            path,
            variantIds,
            label,
            defaultValue: value,
          }),
        ),
      });
    }
  }
  return { version: 2, affectedRecipes: recipes.length, recipes };
}
