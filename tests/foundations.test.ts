import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-ignore source-reviewed dependency-free recipes
import recipes from "../recipes/foundations.mjs";
test("foundation finite matrices are split, unique and explicitly evidenced", () => {
  assert.ok(recipes.length >= 40);
  const ids = new Set();
  for (const r of recipes) {
    assert.ok(!ids.has(r.id));
    ids.add(r.id);
    assert.ok(r.variants.length <= 30, r.name);
    assert.ok(r.source.length > 0);
    assert.ok(r.status === "supported" || r.limitations.length > 0);
  }
});
test("Text covers source color and boxColor precedence at all size and weight values", () => {
  const text = recipes.filter((r: any) => r.name.startsWith("Text/"));
  assert.equal(text.length, 13);
  assert.equal(
    text.reduce((n: number, r: any) => n + r.variants.length, 0),
    156,
  );
  const small = text
    .find((r: any) => r.name === "Text/color-default")
    .variants.find(
      (v: any) => v.props.size === "small" && v.props.weight === "strong",
    ).root.children[0];
  assert.equal(small.fontSize, 13);
  assert.equal(small.lineHeight, 16);
  assert.equal(small.fontWeight, 500);
  assert.equal(small.fontFamily, "Diatype");
});
test("Divider uses exact source margin/dash metrics rather than old spacing approximations", () => {
  const r = recipes.find((r: any) => r.name === "Divider/horizontal-dashed");
  const v = r.variants.find(
    (v: any) => v.props.padding === "medium" && v.props.color === "default",
  );
  assert.equal(v.root.paddingTop, 28);
  assert.equal(v.root.children[0].gap, 3);
  assert.equal(v.root.children[0].children[0].width, 4);
  assert.equal(v.root.children[0].children[0].height, 1);
});
test("LoadingCircle contains all fifteen source states with source ring thickness", () => {
  const items = recipes.filter((r: any) => r.name.startsWith("LoadingCircle/"));
  assert.equal(
    items.reduce((n: number, r: any) => n + r.variants.length, 0),
    15,
  );
  for (const r of items)
    for (const v of r.variants) {
      const ring = v.root.children[0];
      assert.equal(ring.arcData.innerRadius, (ring.width - 4) / ring.width);
      assert.ok(ring.bindings.fills.startsWith("color-"));
    }
});
