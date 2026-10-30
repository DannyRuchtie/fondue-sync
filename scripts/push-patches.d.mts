export function generatePushPatch(options: {
  proposal: any;
  sourceRoot: string;
  baselineRoot?: string;
  bundle?: any;
  mappings?: any[];
  tokenAuthoring?: any;
}): Promise<{
  files: { path: string; before: string | null; after: string }[];
  issues: any[];
  warnings: string[];
  coverage: any;
  checks: string[];
}>;
