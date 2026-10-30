import type { Recipe } from "../src/schema";
export function dedupeLimitations(values?: readonly string[]): string[];
export function normalizeRecipeDocumentation<
  T extends Pick<Recipe, "limitations"> & {
    documentation?: Partial<NonNullable<Recipe["documentation"]>>;
  },
>(recipe: T): T;
export function documentation(
  recipe: Recipe,
  source: string,
  commit: string,
): Recipe["documentation"];
