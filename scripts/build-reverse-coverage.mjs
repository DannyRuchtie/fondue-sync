import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildReverseCoverage,
  visualProperties,
} from "../recipes/reverse-mappings.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundle = JSON.parse(
  await readFile(path.join(root, "bundles/fondue-13.11.1.json"), "utf8"),
);
const coverage = await buildReverseCoverage(bundle, (p) =>
  readFile(path.join(root, ".cache/release", p), "utf8"),
);
const entries = coverage.entries.map((entry) => ({
  recipeId: entry.recipeId,
  componentName: entry.componentName,
  ownership: entry.recipeId.startsWith("patterns/")
    ? "fondue-sync-recipe"
    : "fondue-repository",
  status: entry.sources.some((s) => s.declarations.length)
    ? "source-target-review-available"
    : "adapter-required",
  sourceCandidates: entry.sources.map((s) => ({
    path: s.path,
    missing: s.missing ?? false,
    declarations: s.declarations.length,
    properties: [...new Set(s.declarations.map((d) => d.property))].sort(),
  })),
  propertyCandidates: Object.fromEntries(
    Object.entries(visualProperties).map(([property, css]) => [
      property,
      entry.sources.reduce(
        (n, s) =>
          n + s.declarations.filter((d) => css.includes(d.property)).length,
        0,
      ),
    ]),
  ),
  note: "Candidate availability is not proof of correct layer/variant mapping or runtime accessibility. Unambiguous root token mappings are resolved against each selected change; other declarations require explicit source-target review.",
}));
const report = {
  schemaVersion: 1,
  release: bundle.release,
  sourceCommit: bundle.provenance.commit,
  bundleFingerprint: bundle.fingerprint,
  totalRecipes: entries.length,
  upstreamRecipes: entries.filter((e) => e.ownership === "fondue-repository")
    .length,
  sourceTargetReviewAvailable: entries.filter(
    (e) => e.status === "source-target-review-available",
  ).length,
  adapterRequired: entries.filter((e) => e.status === "adapter-required")
    .length,
  entries,
};
await writeFile(
  path.join(root, "docs/reverse-coverage.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  `Reverse coverage: ${report.totalRecipes} recipes; ${report.sourceTargetReviewAvailable} source review paths; ${report.adapterRequired} require adapters.`,
);
