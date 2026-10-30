import test from "node:test";
import assert from "node:assert/strict";
import { augmentTokenBindings } from "../recipes/token-bindings.mjs";
import release from "../bundles/fondue-13.11.1.json";
import type { Bundle } from "../src/schema";
const walk = (node: any, fn: (node: any) => void) => {
  fn(node);
  for (const child of node.children ?? []) walk(child, fn);
};
test("all frame padding and gap, independent radii and visible border widths have exact-role native bindings", () => {
  const bundle = structuredClone(release) as unknown as Bundle;
  const report = augmentTokenBindings(bundle);
  const tokens = new Map(bundle.tokens.map((t) => [t.id, t]));
  for (const recipe of bundle.recipes)
    for (const variant of recipe.variants)
      walk(variant.root, (n) => {
        if (n.kind === "frame")
          for (const field of [
            "paddingTop",
            "paddingBottom",
            "paddingLeft",
            "paddingRight",
            "itemSpacing",
          ])
            assert.ok(
              tokens.has(n.bindings[field]),
              `${recipe.id}/${n.id}: ${field}`,
            );
        if (n.kind === "frame" || n.kind === "rectangle")
          assert.ok(tokens.has(n.bindings.cornerRadius));
        if (
          n.stroke ||
          n.bindings?.strokes ||
          n.strokeWeight !== undefined ||
          n.strokeWidth !== undefined
        )
          assert.ok(tokens.has(n.bindings.strokeWeight));
      });
  assert.equal(report.counts.exceptions, 0);
  assert.ok(
    report.counts.addedReleasedBindings + report.counts.existingBindings > 0,
  );
  assert.ok(report.counts.derivedVariables > 0);
});
test("existing semantic bindings are retained and equal values never cross spacing/radius/border roles", () => {
  const bundle: Bundle = {
    schemaVersion: 1,
    release: "test",
    fingerprint: "test",
    provenance: {},
    styles: [],
    icons: [],
    inventory: [],
    gaps: [],
    tokens: [
      {
        id: "border-radius-medium",
        name: "border-radius/medium",
        type: "FLOAT",
        collection: "Primitives",
        values: { Value: 4 },
        css: "var(--border-radius-medium)",
      },
      {
        id: "semantic-card-padding",
        name: "card/padding",
        type: "FLOAT",
        collection: "Primitives",
        values: { Value: 4 },
        css: "var(--semantic-card-padding)",
        scopes: ["GAP"],
      },
    ],
    recipes: [
      {
        id: "test",
        name: "Test",
        package: "components",
        source: ["source.tsx"],
        status: "partial",
        limitations: [],
        variants: [
          {
            id: "one",
            props: {},
            root: {
              id: "root",
              name: "Root",
              kind: "frame",
              padding: 4,
              gap: 4,
              radius: 4,
              bindings: { paddingLeft: "semantic-card-padding" },
            },
          },
        ],
      },
    ],
  };
  const report = augmentTokenBindings(bundle),
    root = bundle.recipes[0].variants[0].root;
  assert.equal(root.bindings!.cornerRadius, "border-radius-medium");
  assert.equal(root.bindings!.paddingLeft, "semantic-card-padding");
  assert.equal(root.bindings!.paddingRight, "component-constant-spacing-4");
  assert.equal(root.bindings!.itemSpacing, "component-constant-spacing-4");
  assert.ok(
    report.derivedVariables
      .find((v: any) => v.id === "component-constant-spacing-4")
      .provenance.sourceFiles.includes("source.tsx"),
  );
});
test("derived constants are explicit literal syntax, not fake exported CSS variables, and zero binds too", () => {
  const bundle = structuredClone(release) as unknown as Bundle;
  const report = augmentTokenBindings(bundle);
  const zero = bundle.tokens.find(
    (t) => t.id === "component-constant-spacing-0",
  )!;
  assert.equal(zero.css, "0px");
  assert.equal(zero.values.Value, 0);
  assert.deepEqual(zero.scopes, ["GAP"]);
  assert.ok(
    report.derivedVariables.every((v: any) => !v.css.startsWith("var(")),
  );
  const count = bundle.tokens.length;
  augmentTokenBindings(bundle);
  assert.equal(bundle.tokens.length, count);
});
test("build augmentation leaves cached source recipe definitions untouched for deterministic rebuilds", () => {
  const source = structuredClone(release.recipes),
    before = JSON.stringify(source);
  const bundle = {
    ...structuredClone(release),
    recipes: source,
  } as unknown as Bundle;
  augmentTokenBindings(bundle);
  assert.equal(JSON.stringify(source), before);
  assert.notEqual(bundle.recipes, source);
  const tokens = bundle.tokens.length;
  augmentTokenBindings(bundle);
  assert.equal(bundle.tokens.length, tokens);
});

test("fractional source geometry uses native-safe variable names", () => {
  const bundle = structuredClone(release) as unknown as Bundle;
  augmentTokenBindings(bundle);
  for (const token of bundle.tokens)
    assert.ok(!/[.{}]/.test(token.name), token.name);
});
