import type { Recipe, Layer, Bundle } from "./schema";
export type ComponentPropertyGroup = {
  prefix: string;
  type: "TEXT" | "INSTANCE_SWAP";
  path: string;
  value: string;
  variantIds: string[];
  collision: boolean;
  label: string;
};
export function componentPropertyGroups(
  recipe: Recipe,
  iconDefault: (layer: Layer) => string,
): ComponentPropertyGroup[];
export function sourceIconDefault(layer: Layer, icons: Bundle["icons"]): string;
export function augmentComponentPropertyPolicies(bundle: Bundle): {
  version: number;
  affectedRecipes: number;
  recipes: any[];
};
