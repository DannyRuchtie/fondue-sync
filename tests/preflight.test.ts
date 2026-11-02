import test from "node:test";
import assert from "node:assert/strict";
import { migrationProblems, bundleProblems } from "../src/preflight";
import releaseBundle from "../bundles/fondue-13.11.1.json";
import type { Bundle } from "../src/schema";
import legacyPatterns from "./fixtures/product-pattern-legacy-structure.json";
// @ts-ignore authored recipe module
import { patterns, additionalPatterns } from "../recipes/examples.mjs";

test("all recorded Figma product-pattern structures can migrate to base composition", () => {
  assert.equal(legacyPatterns.recipes.length, 18);
  assert.equal(
    legacyPatterns.recipes.reduce(
      (count, recipe) => count + recipe.variants.length,
      0,
    ),
    71,
  );
  const current = [...patterns, ...additionalPatterns];
  for (const previous of legacyPatterns.recipes) {
    const next = current.find((recipe: any) => recipe.id === previous.id);
    assert.ok(next, previous.id);
    assert.deepEqual(
      migrationProblems("recipe", previous, next),
      [],
      previous.id,
    );
  }
});
const previous = {
  id: "test",
  variants: [
    {
      id: "default",
      props: { state: "default" },
      root: {
        id: "root",
        kind: "frame",
        children: [
          {
            id: "left",
            kind: "frame",
            children: [{ id: "label", kind: "text", text: "Before" }],
          },
          { id: "right", kind: "frame", children: [] },
        ],
      },
    },
  ],
};
test("migration preflight detects nested reparenting even when flattened id-kind inventory stays unchanged", () => {
  const next = structuredClone(previous);
  next.variants[0].root.children[1].children.push(
    next.variants[0].root.children[0].children.pop()!,
  );
  assert.ok(
    migrationProblems("recipe", previous, next).some(
      (p) => p.code === "layer-path",
    ),
  );
});
test("nonstructural text and geometry updates remain allowed", () => {
  const next = structuredClone(previous);
  next.variants[0].root.children[0].children[0].text = "After";
  assert.deepEqual(migrationProblems("recipe", previous, next), []);
});
test("product composition policy permits only same-path frame replacement and its former descendants", () => {
  const next: any = structuredClone(previous);
  next.package = "fondue-sync/patterns";
  next.compositionPolicy = 1;
  next.variants[0].root.children[0] = {
    id: "left",
    kind: "componentInstance",
    componentName: "Button",
    name: "Left",
  };
  assert.deepEqual(migrationProblems("recipe", previous, next), []);
  const unmarked = structuredClone(next);
  delete unmarked.compositionPolicy;
  assert.ok(
    migrationProblems("recipe", previous, unmarked).some(
      (p) => p.code === "layer-type",
    ),
  );
  const upstream = { ...next, package: "@frontify/fondue" };
  assert.ok(
    migrationProblems("recipe", previous, upstream).some(
      (p) => p.code === "layer-type",
    ),
  );
  const unrelatedRemoval = structuredClone(next);
  unrelatedRemoval.variants[0].root.children.pop();
  assert.ok(
    migrationProblems("recipe", previous, unrelatedRemoval).some(
      (p) => p.code === "layer-path",
    ),
  );
  const rootReplacement = structuredClone(next);
  rootReplacement.variants[0].root = {
    id: "root",
    kind: "componentInstance",
    componentName: "Card",
  };
  assert.ok(
    migrationProblems("recipe", previous, rootReplacement).some(
      (p) => p.code === "layer-type",
    ),
  );
  const renamed = structuredClone(next);
  renamed.variants[0].root.children[0].id = "new-left";
  assert.ok(
    migrationProblems("recipe", previous, renamed).some(
      (p) => p.code === "layer-path",
    ),
  );
  assert.ok(
    migrationProblems("recipe", previous, { ...next, variants: [] }).some(
      (p) => p.code === "variant-removal",
    ),
  );
});

test("instance anatomy overrides reject missing or ambiguous paths and structural changes", () => {
  const check = (overrides: any) => {
    const b = structuredClone(releaseBundle) as unknown as Bundle;
    const sourceText = (node: any): any =>
      node.kind === "text"
        ? node
        : (node.children ?? []).map(sourceText).find(Boolean);
    const typography = b.recipes
      .map((r) => sourceText(r.variants[0].root))
      .find(Boolean);
    b.recipes.push({
      id: "components/OverrideFixture",
      name: "OverrideFixture",
      package: "test",
      source: [],
      status: "partial",
      limitations: [],
      variants: [
        {
          id: "default",
          props: {},
          root: {
            id: "root",
            name: "Root",
            kind: "frame",
            children: [
              {
                id: "one",
                name: "One",
                kind: "frame",
                children: [
                  { ...typography, id: "label", name: "Label", text: "First" },
                ],
              },
              {
                id: "two",
                name: "Two",
                kind: "frame",
                children: [
                  { ...typography, id: "label", name: "Label", text: "Second" },
                ],
              },
            ],
          },
        },
      ],
    });
    b.examples = [
      {
        id: "override-example",
        name: "Example",
        root: {
          id: "fixture",
          name: "Fixture",
          kind: "componentInstance",
          recipeId: "components/OverrideFixture",
          instanceOverrides: overrides,
        },
      },
    ];
    return bundleProblems(b);
  };
  assert.deepEqual(
    check({ "one/label": { text: "Updated" }, __root__: { width: 420 } }),
    [],
  );
  for (const path of ["missing", "label"])
    assert.ok(
      check({ [path]: { text: "Unsafe" } }).some(
        (p) => p.code === "instance-override-path",
      ),
    );
  assert.ok(
    check({ "one/label": { children: [] } }).some(
      (p) => p.code === "instance-override-structure",
    ),
  );
});
test("immutable type collection and native geometry changes are blocked during planning", () => {
  assert.equal(
    migrationProblems(
      "token",
      { id: "t", type: "FLOAT", collection: "Primitives" },
      { id: "t", type: "FLOAT", collection: "Semantic" },
    )[0].code,
    "token-collection",
  );
  assert.equal(
    migrationProblems("style", { type: "TEXT" }, { type: "EFFECT" })[0].code,
    "style-type",
  );
  assert.equal(
    migrationProblems("icon", { svg: "old" }, { svg: "new" })[0].code,
    "icon-geometry",
  );
});
test("full released dependency graph validates before native mutation", () =>
  assert.deepEqual(bundleProblems(releaseBundle as unknown as Bundle), []));
test("alias cycles and absent dependencies cannot get as far as shell creation", () => {
  const b = structuredClone(releaseBundle) as unknown as Bundle;
  b.tokens[0].values = { Value: { alias: b.tokens[0].id } };
  b.recipes[0].variants[0].root.bindings = { fills: "absent-token" };
  const errors = bundleProblems(b);
  assert.ok(errors.some((p) => p.code === "alias-cycle"));
  assert.ok(errors.some((p) => p.code === "missing-binding"));
});
test("missing example components and nonexistent text properties fail before native mutations", () => {
  const bundle = structuredClone(releaseBundle) as unknown as Bundle;
  bundle.examples = [
    {
      id: "bad",
      name: "Bad",
      root: {
        id: "root",
        kind: "componentInstance",
        name: "Missing",
        componentName: "Nonexistent",
        text: "Value",
      },
    },
  ] as any;
  assert.ok(
    bundleProblems(bundle).some((p) => p.code === "missing-component-instance"),
  );
});
test("native component dependency cycles are rejected before canvas mutation", () => {
  const bundle = structuredClone(releaseBundle) as unknown as Bundle;
  const recipe = bundle.recipes[0];
  recipe.variants[0].root.children ??= [];
  recipe.variants[0].root.children.push({
    id: "cycle",
    kind: "componentInstance",
    name: "Cycle",
    recipeId: recipe.id,
  });
  assert.ok(bundleProblems(bundle).some((p) => p.code === "component-cycle"));
});

test("example structural removals and optical SVG changes require explicit migrations", () => {
  const root = {
    id: "screen",
    kind: "frame",
    name: "Screen",
    children: [
      { id: "content", kind: "text", name: "Content", text: "Content" },
    ],
  };
  assert.equal(
    migrationProblems(
      "example",
      { root },
      { root: { ...root, children: [] } },
    )[0].code,
    "layer-path",
  );
  assert.equal(
    migrationProblems(
      "icon",
      { id: "icon", svg: "same", sizes: [{ size: 16, svg: "old" }] },
      { id: "icon", svg: "same", sizes: [{ size: 16, svg: "new" }] },
    )[0].code,
    "icon-optics",
  );
});
test("explicit layer sizing uses native sizing enums before allocation", () => {
  const b = structuredClone(releaseBundle) as unknown as Bundle;
  (b.recipes[0].variants[0].root as any).layoutSizingHorizontal = "AUTO";
  assert.ok(bundleProblems(b).some((p) => p.code === "layer-sizing"));
});

test("effect and SVG bindings validate referenced native variable roles before mutation", () => {
  const b = structuredClone(releaseBundle) as unknown as Bundle;
  const color = b.tokens.find((t) => t.type === "COLOR")!.id;
  const number = b.tokens.find((t) => t.type === "FLOAT")!.id;
  b.styles.push({
    id: "review-effect",
    type: "EFFECT",
    name: "review effect",
    effects: [],
    effectBindings: [
      { color: number, radius: color, offsetX: "missing-effect-variable" },
    ],
  });
  b.recipes[0].variants[0].root.children ??= [];
  b.recipes[0].variants[0].root.children.push({
    id: "review-svg",
    kind: "svg",
    name: "review SVG",
    svg: "<svg/>",
    svgPaintBindings: [{ paint: "fill", color: "#ffffff", tokenId: number }],
  });
  const problems = bundleProblems(b);
  assert.ok(problems.some((p) => p.code === "effect-binding-type"));
  assert.ok(
    problems.some(
      (p) =>
        p.code === "missing-binding" &&
        p.message.includes("missing-effect-variable"),
    ),
  );
  assert.ok(problems.some((p) => p.code === "svg-color-type"));
});

test("container retirement requires explicit changed base-control composition", () => {
  const before: any = structuredClone(previous);
  before.variants[0].root.children = [
    { id: "left", kind: "text", text: "Before" },
    { id: "right", kind: "rectangle" },
  ];
  const next: any = structuredClone(before);
  next.package = "fondue-sync/patterns";
  next.compositionPolicy = 1;
  next.variants[0].root.children = [
    {
      id: "control",
      kind: "componentInstance",
      componentName: "Button",
      componentRole: "button",
    },
  ];
  assert.deepEqual(migrationProblems("recipe", before, next), []);
  const noRole = structuredClone(next);
  delete noRole.variants[0].root.children[0].componentRole;
  assert.ok(
    migrationProblems("recipe", before, noRole).some(
      (p) => p.code === "layer-path",
    ),
  );
  const patternReference = structuredClone(next);
  delete patternReference.variants[0].root.children[0].componentName;
  patternReference.variants[0].root.children[0].recipeId =
    "patterns/ProductionCard";
  assert.ok(
    migrationProblems("recipe", before, patternReference).some(
      (p) => p.code === "layer-path",
    ),
  );
  const unchanged: any = structuredClone(next);
  unchanged.variants[0].root.children.push({
    id: "retired",
    kind: "text",
    text: "Old label",
  });
  assert.ok(
    migrationProblems("recipe", unchanged, next).some(
      (p) => p.code === "layer-path",
    ),
  );
  const changed: any = structuredClone(unchanged);
  changed.variants[0].root.children[0].componentName = "Heading";
  changed.variants[0].root.children[0].componentRole = "text";
  assert.deepEqual(migrationProblems("recipe", changed, next), []);
});
