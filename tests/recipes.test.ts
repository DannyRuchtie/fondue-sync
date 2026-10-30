import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
// @ts-expect-error Recipes are reviewed JS input, serialized into typed bundle.
import recipes from "../recipes/index.mjs";
const source = new URL("../.cache/release/", import.meta.url);
const css =
  fs.readFileSync(
    new URL("packages/tokens/dist/css/base.css", source),
    "utf8",
  ) +
  fs.readFileSync(
    new URL("packages/tokens/dist/themes/themes.module.css", source),
    "utf8",
  );
const tokenNames = new Set(
  [...css.matchAll(/--([\w-]+)\s*:/g)].map((m) => m[1]),
);
const walk = (layer: any, fn: (n: any) => void) => {
  fn(layer);
  for (const c of layer.children ?? []) walk(c, fn);
};
test("every current visual public component family has a native recipe", () => {
  const exports = fs.readFileSync(
    new URL("packages/components/src/index.ts", source),
    "utf8",
  );
  const names = [...exports.matchAll(/from '\.\/components\/([^'/]+)/g)]
    .map((m) => m[1])
    .filter((n) => !["RouterProvider", "ThemeProvider"].includes(n));
  assert.equal(names.length, 39);
  for (const name of names)
    assert.ok(
      recipes.some(
        (r: any) =>
          r.package === "@frontify/fondue/components" &&
          r.name.split("/")[0] === name,
      ),
      name,
    );
  for (const name of [
    "AreaStackChart",
    "BarChart",
    "ChartHeading",
    "LineChart",
    "LinearGauge",
    "PieChart",
    "Treemap",
  ])
    assert.ok(
      recipes.some((r: any) => r.name === name),
      name,
    );
});
test("recipes resolve actual released source and every binding targets committed token output", () => {
  for (const recipe of recipes) {
    assert.ok(recipe.source.length, recipe.name);
    recipe.source.forEach((p: string) =>
      assert.ok(fs.existsSync(new URL(p, source)), p),
    );
    assert.ok(recipe.variants.length <= 30, recipe.name);
    assert.ok(
      recipe.status === "partial" && recipe.limitations.length > 0,
      "Coverage must not imply complete public API fidelity.",
    );
    for (const v of recipe.variants)
      walk(v.root, (n) => {
        for (const t of Object.values(n.bindings ?? {}))
          assert.ok(tokenNames.has(t as string), `${recipe.name}: ${t}`);
        const ids = (n.children ?? []).map((c: any) => c.id);
        assert.equal(
          new Set(ids).size,
          ids.length,
          `${recipe.name}/${n.id}: duplicate sibling identity`,
        );
      });
  }
});
test("button source dimensions and font sizes survive recipe serialization", () => {
  const sets = recipes.filter((r: any) => r.name.startsWith("Button/"));
  assert.equal(sets.length, 5);
  for (const r of sets)
    for (const v of r.variants) {
      assert.equal(
        v.root.height,
        ({ small: 24, medium: 36, large: 48 } as any)[v.props.size],
      );
      assert.equal(v.root.padding, 0);
      assert.equal(
        v.root.children[0].fontSize,
        ({ small: 13, medium: 14, large: 16 } as any)[v.props.size],
      );
    }
});
test("native icon references and explicit typography styles resolve release bundle identities", () => {
  const bundle = JSON.parse(
    fs.readFileSync(
      new URL("../bundles/fondue-13.11.1.json", import.meta.url),
      "utf8",
    ),
  );
  const icons = new Set(bundle.icons.map((i: any) => i.id));
  const styles = new Set(bundle.styles.map((s: any) => s.id));
  let iconRefs = 0;
  for (const r of recipes)
    for (const v of r.variants)
      walk(v.root, (n) => {
        if (n.kind === "instance") {
          assert.ok(icons.has(n.iconId), n.iconId);
          iconRefs++;
        }
        if (n.textStyle) assert.ok(styles.has(n.textStyle), n.textStyle);
      });
  assert.ok(
    iconRefs > 20,
    "Compound recipes should consume shared native icon instances.",
  );
  for (const heading of recipes.find((r: any) => r.name === "Heading").variants)
    assert.equal(
      heading.root.children[0].textStyle,
      `text-heading-${heading.props.size}-default`,
    );
});
