import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import recipes, {
  controlCoverage,
  omittedSourceStates,
} from "../recipes/controls.mjs";
const bundle = JSON.parse(
  fs.readFileSync(
    new URL("../bundles/fondue-13.11.1.json", import.meta.url),
    "utf8",
  ),
);
const tokens = new Set(bundle.tokens.map((t: any) => t.id)),
  icons = new Set(bundle.icons.map((i: any) => i.id));
const walk = (n: any, fn: (n: any) => void) => {
  fn(n);
  for (const c of n.children ?? []) walk(c, fn);
};
test("finite control matrices partition without duplicate native identities or missing source bindings", () => {
  assert.equal(new Set(recipes.map((r: any) => r.id)).size, recipes.length);
  for (const r of recipes) {
    assert.ok(r.variants.length <= 30);
    assert.equal(
      new Set(r.variants.map((v: any) => v.id)).size,
      r.variants.length,
    );
    for (const v of r.variants)
      walk(v.root, (n) => {
        for (const id of Object.values(n.bindings ?? {}))
          assert.ok(tokens.has(id as string), `${r.name}: ${id}`);
        if (n.iconId) assert.ok(icons.has(n.iconId), n.iconId);
        assert.equal(
          new Set((n.children ?? []).map((c: any) => c.id)).size,
          (n.children ?? []).length,
          `${r.name}: ${n.id}`,
        );
      });
  }
});
test("Button reviewed source profiles and Checkbox all three values are represented", () => {
  const b = recipes.filter((r: any) => r.name.startsWith("Button/"));
  assert.equal(
    b.reduce((n: number, r: any) => n + r.variants.length, 0),
    127,
  );
  const props = b.flatMap((r: any) => r.variants).map((v: any) => v.props);
  assert.equal(new Set(props.map((p: any) => JSON.stringify(p))).size, 127);
  const check = controlCoverage.find((c: any) => c.name === "Checkbox");
  assert.deepEqual(check.axes.value, ["unchecked", "checked", "indeterminate"]);
  const c = recipes
    .filter((r: any) => r.name.startsWith("Checkbox/"))
    .flatMap((r: any) => r.variants);
  assert.equal(c.length, 120);
});
test("upstream absent tokens remain explicit coverage gaps instead of dangling bindings", () => {
  const partial = recipes.filter((r: any) => r.status === "partial");
  assert.ok(partial.length > 0);
  assert.equal(omittedSourceStates.length, 27);
  assert.ok(
    omittedSourceStates.every((state: any) => state.reason.includes("omitted")),
  );
  assert.ok(
    partial.every((r: any) =>
      r.limitations.some(
        (x: string) =>
          x.includes("Source-data gap") ||
          x.includes("Reviewed profile contract"),
      ),
    ),
  );
});
