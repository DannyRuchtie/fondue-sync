import test from "node:test";
import assert from "node:assert/strict";
import { migrationProblems, bundleProblems } from "../src/preflight";
import releaseBundle from "../bundles/fondue-13.11.1.json";
import type { Bundle } from "../src/schema";
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
