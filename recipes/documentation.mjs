import fs from "node:fs";
import path from "node:path";
/** Collapse repeated extraction caveats without discarding distinct source gaps. */
export function dedupeLimitations(values = []) {
  const result = [],
    seen = new Set();
  for (const value of values)
    for (const part of String(value ?? "").split(
      /\n+|(?<=[.!?])\s+(?=[A-Z])/,
    )) {
      const text = part.replace(/\s+/g, " ").trim();
      const key = text.toLowerCase().replace(/[.!?]+$/, "");
      if (key && !seen.has(key)) {
        seen.add(key);
        result.push(text);
      }
    }
  return result;
}
/** Call after all recipe transforms and before bundle hashing. */
export function normalizeRecipeDocumentation(recipe) {
  recipe.limitations = dedupeLimitations(recipe.limitations);
  if (recipe.documentation) {
    for (const field of ["purpose", "usage", "description"])
      if (typeof recipe.documentation[field] === "string")
        recipe.documentation[field] = dedupeLimitations([
          recipe.documentation[field],
        ]).join("\n\n");
  }
  return recipe;
}
/** Use released metadata verbatim. Editorial fallbacks identify their authorship. */
export function documentation(recipe, source, commit) {
  recipe.limitations = dedupeLimitations(recipe.limitations);
  const family = recipe.name.split("/")[0].split(".")[0];
  const folder = `packages/${recipe.package.replace("@frontify/fondue/", "")}/src/components/${family}`;
  const metadataPath = `${folder}/${family}.metadata.json`;
  const exists = fs.existsSync(path.join(source, metadataPath));
  const meta = exists
    ? JSON.parse(fs.readFileSync(path.join(source, metadataPath), "utf8"))
    : {};
  const axes = {};
  for (const variant of recipe.variants)
    for (const [key, value] of Object.entries(variant.props)) {
      axes[key] ??= [];
      if (!axes[key].includes(value)) axes[key].push(value);
    }
  const purpose =
    meta.description ??
    `Native design representation of ${recipe.name} from the released Fondue ${recipe.package} package.`;
  const usage =
    meta.instructions ??
    "Fondue Sync editorial guidance: use this asset to compose the structure represented by its released source. Review the linked source and coverage notes before using states beyond the exposed properties.";
  const properties = Object.entries(axes)
    .map(([key, values]) => `${key}: ${values.join(", ")}`)
    .join("\n");
  const sourcePath =
    recipe.source.find((p) => fs.existsSync(path.join(source, p))) ?? folder;
  const url = `https://github.com/Frontify/fondue/tree/${commit}/${sourcePath}`;
  return {
    purpose,
    usage,
    properties,
    related: meta.relatedComponents ?? [],
    origin: exists ? "released-metadata" : "fondue-sync-editorial",
    metadataSource: exists ? metadataPath : null,
    links: [{ uri: url }, { uri: "https://fondue.frontify.com/" }],
    description: [
      purpose,
      usage,
      `Exposed variant properties:\n${properties}`,
      "Text properties edit the exposed content. Icon properties swap the native icon; Show properties control its visibility.",
      `Coverage: ${recipe.status}. ${dedupeLimitations(recipe.limitations).join(" ")}`,
      `Source: ${url}`,
    ].join("\n\n"),
  };
}
