import type { Recipe } from "./schema";

/** Repeated extraction warnings are editorial noise, not additional coverage. */
export function uniqueSentences(values: readonly string[]): string[] {
  const seen = new Set<string>(),
    result: string[] = [];
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
function brief(value: string, words = 44) {
  const tokens = value.replace(/\s+/g, " ").trim().split(" ");
  return tokens.length > words
    ? tokens
        .slice(0, words)
        .join(" ")
        .replace(/[,;:]$/, "") + "..."
    : tokens.join(" ");
}
export function friendlyProperty(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^color-/, "")
    .replace(/-default$/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
export type FamilyDocumentation = {
  family: string;
  purpose: string;
  usage: string;
  controls: string[];
  notes: string[];
  profileCount: number;
  variantCount: number;
  sourceLinks: string[];
  primaryRecipeId: string;
};
export function familyDocumentation(
  recipes: readonly Recipe[],
): FamilyDocumentation {
  if (!recipes.length)
    throw Error("Family documentation needs at least one source recipe.");
  const family = recipes[0].name.split("/")[0];
  const primary = recipes.find((r) => r.name === family) ?? recipes[0];
  const axes = new Map<string, Set<string>>();
  for (const recipe of recipes)
    for (const variant of recipe.variants)
      for (const [key, value] of Object.entries(variant.props)) {
        if (!axes.has(key)) axes.set(key, new Set());
        axes.get(key)!.add(String(value));
      }
  const order = [
    "variant",
    "emphasis",
    "size",
    "state",
    "disabled",
    "checked",
    "direction",
  ];
  const controls = [...axes].sort(
    ([a], [b]) =>
      (order.includes(a) ? order.indexOf(a) : 99) -
        (order.includes(b) ? order.indexOf(b) : 99) || a.localeCompare(b),
  );
  const notes = uniqueSentences(recipes.flatMap((r) => r.limitations));
  const concreteNotes = notes.filter(
    (note) =>
      !/static editable|runtime behavior|browser event|source styling|native figma visual|visual parity|not every public|property default|source-derived|all native|font availability|runtime computed|full public/i.test(
        note,
      ),
  );
  const purpose = brief(
    primary.documentation?.purpose ??
      `Use ${friendlyProperty(family)} to compose its represented source behavior.`,
    34,
  );
  const usage = brief(
    uniqueSentences(recipes.map((r) => r.documentation?.usage ?? ""))
      .slice(0, 2)
      .join(" "),
    48,
  );
  return {
    family,
    purpose,
    usage,
    controls: controls
      .slice(0, 6)
      .map(
        ([key, values]) =>
          `${friendlyProperty(key)}: ${values.size <= 5 ? [...values].map(friendlyProperty).join(", ") : values.size + " represented values"}`,
      ),
    notes: (concreteNotes.length ? concreteNotes : notes)
      .slice(0, 3)
      .map((note) => brief(note, 25)),
    profileCount: recipes.length,
    variantCount: recipes.reduce((n, r) => n + r.variants.length, 0),
    sourceLinks: [
      ...new Set(
        recipes.flatMap(
          (r) => r.documentation?.links.map((link) => link.uri) ?? [],
        ),
      ),
    ],
    primaryRecipeId: primary.id,
  };
}
/** Existing guide child identities remain compatible with the engine's six paragraphs. */
export function conciseGuideParagraphs(
  recipes: readonly Recipe[],
): [string, string, string][] {
  const doc = familyDocumentation(recipes);
  return [
    ["Title", doc.family, "text-heading-xx-large-default"],
    ["Purpose", doc.purpose, "text-body-medium-default"],
    [
      "Usage",
      doc.usage ||
        "Choose a profile, then adjust supported properties on its native instance.",
      "text-body-medium-default",
    ],
    ["Properties", doc.controls.join("\n"), "text-body-small-default"],
    [
      "Coverage",
      `${doc.profileCount} profiles / ${doc.variantCount} represented variants.\n${doc.notes.join("\n")}`,
      "text-body-x-small-default",
    ],
    [
      "Source",
      "Select a preview to inspect its native properties. Complete source and profile notes are available on the library master.",
      "text-body-x-small-default",
    ],
  ];
}
export function profileCaption(recipe: Recipe): string {
  const props = recipe.variants[0]?.props ?? {};
  const values = [
    "color",
    "variant",
    "emphasis",
    "size",
    "weight",
    "state",
    "disabled",
  ]
    .filter((key) => props[key] !== undefined)
    .map((key) => friendlyProperty(props[key]));
  const suffix = recipe.name
    .split("/")
    .slice(1)
    .map(friendlyProperty)
    .join(" / ");
  return brief(
    [...new Set(values)].slice(0, 3).join(" / ") ||
      suffix ||
      friendlyProperty(recipe.name),
    10,
  );
}
