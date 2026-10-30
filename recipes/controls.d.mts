import type { Recipe } from "../src/schema";
declare const recipes: Recipe[];
export default recipes;
export const controlCoverage: any[];
export const omittedSourceStates: {
  recipeId: string;
  variantId: string;
  props: Record<string, string>;
  tokens: string[];
  reason: string;
}[];
export const sourceTokenDefects: {
  token: string;
  family: string;
  source: string;
  lines: number[];
  state: string;
}[];
export const profilePolicy: Record<string, string>;
