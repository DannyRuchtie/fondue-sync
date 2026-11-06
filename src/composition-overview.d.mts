import type { Bundle } from "./schema";
export function compositionOverview(
  bundle: Bundle,
  policies?: Record<
    string,
    {
      mode: string;
      regions: string[];
      reason: string;
      requiredRecipes?: string[];
      requiredSlots?: {
        recipeId: string;
        names: string[];
        when?: Record<string, string>;
      }[];
      entryRecipeId?: string;
    }
  >,
): NonNullable<Bundle["composition"]>;
export function compositionMarkdown(
  rows: NonNullable<Bundle["composition"]>,
): string;
