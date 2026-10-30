export const visualProperties: Readonly<Record<string, string[]>>;
export function declarations(source: string): {
  selector: string;
  property: string;
  value: string;
  start: number;
  end: number;
  tokens: string[];
}[];
export function sourcePaths(recipe: any): string[];
export function buildReverseCoverage(
  bundle: any,
  readSource: (path: string) => Promise<string>,
  mappings?: any[],
): Promise<any>;
export function candidatesForChange(change: any, coverage: any): any[];
export function tailwindDeclarations(source: string): any[];
export function sourceDeclarations(path: string, source: string): any[];
export function hasRootStyleClass(source: string): boolean;
export function selectorMatchesVariant(
  selector: string,
  props: Record<string, string>,
): boolean;
export function replacePaddingSide(
  value: string,
  field: string,
  replacement: string,
): string;
export function tokenRole(
  token: any,
  cssName?: string,
  tokens?: any[],
  seen?: Set<string>,
): string | undefined;
export function tokenCompatibleWithProperty(
  token: any,
  field: string,
  cssName?: string,
  tokens?: any[],
): boolean;
export function scssBlocks(
  source: string,
): { selector: string; start: number; end: number }[];
