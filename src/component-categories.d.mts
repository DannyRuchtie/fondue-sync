import type { Recipe } from "./schema";
export function componentCategory(
  recipe: Pick<Recipe, "package" | "name">,
): string | undefined;
export function componentAssetName(
  recipe: Pick<Recipe, "package" | "name">,
): string;
