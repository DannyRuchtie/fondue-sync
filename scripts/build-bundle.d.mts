export const RELEASE: string;
export const COMMIT: string;
export function sha(data: string | Uint8Array): string;
export function declarations(css: string): Record<string, string>;
export function cssValue(raw: string): any;
export function validateAliases(tokens: any[]): void;
export function parseTokens(
  baseCss: string,
  themesCss: string,
): { tokens: any[]; composites: any[]; raw: Record<string, string> };
export function makeStyles(
  tokens: any[],
  composites: any[],
  raw: Record<string, string>,
): any[];
export function validateSourceLock(source: string, lock: any): void;
export function build(source?: string): Promise<any>;
