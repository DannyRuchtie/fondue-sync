import test from "node:test";
import assert from "node:assert/strict";
// @ts-ignore source-authored ESM
import * as auditModule from "../src/composition-audit.mjs";
// @ts-ignore source-authored ESM
import * as examplesModule from "../recipes/examples.mjs";
// @ts-ignore source-authored ESM
import base from "../recipes/index.mjs";
// @ts-ignore source-authored ESM
import controls from "../recipes/controls.mjs";
// @ts-ignore source-authored ESM
import foundations from "../recipes/foundations.mjs";
// @ts-ignore source-authored ESM
import complex from "../recipes/patterns.mjs";
// @ts-ignore source-authored ESM
import media from "../recipes/media-components.mjs";
const { auditProductPatternComposition, productPatternCompositionReport } =
  auditModule;
const { patterns, additionalPatterns, normalizeProductionComposition } =
  examplesModule;

const recipes = [
  ...base,
  ...controls,
  ...foundations,
  ...complex,
  ...media,
  ...patterns,
  ...additionalPatterns,
];
const simple = (child: any, name = "ProductionNavigationRail") => [
  {
    id: "patterns/" + name,
    name,
    variants: [
      {
        id: "default",
        props: {},
        root: { id: "root", kind: "frame", children: [child] },
      },
    ],
  },
];

test("all product-pattern families are audited and controls resolve canonical base variants", () => {
  const report = productPatternCompositionReport(recipes);
  assert.equal(report.length, 18);
  assert.ok(
    report.every((r: any) => r.reviewed),
    JSON.stringify(report),
  );
  assert.deepEqual(auditProductPatternComposition(recipes), []);
});

test("composition audit rejects recreated controls, including declared future semantic roles", () => {
  for (const child of [
    { id: "utility-3", kind: "frame" },
    { id: "new-control", kind: "frame", componentRole: "button" },
    {
      id: "navigation-search",
      kind: "frame",
      children: [{ id: "icon", kind: "instance" }],
    },
  ])
    assert.ok(
      auditProductPatternComposition(simple(child)).some(
        (p: any) => p.code === "recreated-control",
      ),
    );
  assert.ok(
    auditProductPatternComposition(
      simple({ id: "x", kind: "frame" }, "ProductionNewSurface"),
    ).some((p: any) => p.code === "unaudited-pattern"),
  );
});

test("rich row wrappers must contain real base controls rather than typography or another pattern", () => {
  const help = structuredClone(
    additionalPatterns.find((r: any) => r.name === "ProductionHelpDialog"),
  );
  const firstRow = help.variants[0].root.children.find(
    (n: any) => n.id === "help-rows",
  ).children[0];
  const copy = firstRow.children.find((n: any) => n.id === "copy");
  copy.children[0] = { id: "label", kind: "frame", children: [] };
  const next = recipes.map((r: any) => (r.id === help.id ? help : r));
  assert.ok(
    auditProductPatternComposition(next).some(
      (p: any) =>
        p.code === "missing-composed-control" && p.path.endsWith("help-row-0"),
    ),
  );

  const nav = structuredClone(
    patterns.find((r: any) => r.name === "ProductionNavigationRail"),
  );
  const row = nav.variants[0].root.children.find(
    (n: any) => n.id === "utility-navigation",
  ).children[0];
  delete row.componentName;
  row.recipeId = "patterns/ProductionFontsEmpty";
  row.variantProps = {};
  assert.ok(
    auditProductPatternComposition(
      recipes.map((r: any) => (r.id === nav.id ? nav : r)),
    ).some((p: any) => p.code === "nonbase-control"),
  );
});

test("default composition normalization is idempotent for every product-pattern variant", () => {
  for (const recipe of [...patterns, ...additionalPatterns])
    for (const variant of recipe.variants)
      assert.deepEqual(
        normalizeProductionComposition(
          structuredClone(variant.root),
          recipe.name,
        ),
        variant.root,
        `${recipe.id}/${variant.id}`,
      );
});

test("layout and decorative artwork remain native while UI text and unresolved references fail", () => {
  assert.deepEqual(
    auditProductPatternComposition(
      simple({
        id: "layout",
        kind: "frame",
        children: [
          { id: "display", kind: "text", fontFamily: "Cranny" },
          {
            id: "empty-illustration",
            kind: "frame",
            children: [{ id: "letter", kind: "text" }],
          },
        ],
      }),
    ),
    [],
  );
  assert.ok(
    auditProductPatternComposition(simple({ id: "label", kind: "text" })).some(
      (p: any) => p.code === "standalone-ui-text",
    ),
  );
  assert.ok(
    auditProductPatternComposition(
      simple({
        id: "utility-0",
        kind: "componentInstance",
        componentName: "MadeUp",
      }),
    ).some((p: any) => p.code === "missing-base-component"),
  );
});
