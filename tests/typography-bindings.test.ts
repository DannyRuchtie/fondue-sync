import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
// @ts-ignore source reviewed ESM
import { augmentTypographyBindings } from "../recipes/typography-bindings.mjs";
const source = JSON.parse(
  fs.readFileSync(
    new URL("../bundles/fondue-13.11.1.json", import.meta.url),
    "utf8",
  ),
);
const walk = (node: any, fn: (n: any) => void) => {
  fn(node);
  for (const child of node.children ?? []) walk(child, fn);
};
test("every recipe text uses an exact shared style and correctly typed typography variables", () => {
  const b = structuredClone(source);
  const r = augmentTypographyBindings(b);
  const styles = new Map(b.styles.map((s: any) => [s.id, s]));
  const tokens = new Map(b.tokens.map((t: any) => [t.id, t]));
  let count = 0;
  for (const recipe of b.recipes)
    for (const variant of recipe.variants)
      walk(variant.root, (n) => {
        if (n.kind !== "text") return;
        count++;
        const style: any = styles.get(n.textStyle);
        assert.equal(style?.type, "TEXT");
        assert.equal(n.fontSize, style.fontSize);
        assert.equal(
          n.fontWeight,
          style.fontWeight ??
            ({ Regular: 400, Medium: 500, Bold: 700, Light: 300 } as any)[
              style.fontStyle
            ],
        );
        if (n.lineHeight !== undefined)
          assert.equal(n.lineHeight, style.lineHeight);
        for (const field of [
          "fontFamily",
          "fontSize",
          "fontWeight",
          "letterSpacing",
        ]) {
          const token: any = tokens.get(n.bindings[field]);
          assert.equal(token.type, field === "fontFamily" ? "STRING" : "FLOAT");
        }
        if (typeof style.lineHeight === "number")
          assert.ok(n.bindings.lineHeight);
      });
  assert.equal(count, r.counts.textLayers);
  assert.ok(count > 2400);
});
test("effective14/16 metrics do not keep mismatched14/18 style, and no nearest metrics are substituted", () => {
  const b = structuredClone(source);
  const root = {
    id: "root",
    kind: "frame",
    children: [
      {
        id: "brand-title",
        kind: "text",
        name: "Brand assets",
        text: "Brand assets",
        fontSize: 14,
        fontWeight: 500,
        lineHeight: 16,
        textStyle: "text-body-medium-strong",
      },
      {
        id: "odd",
        kind: "text",
        name: "Exact odd size",
        text: "Exact odd size",
        fontSize: 17,
        fontWeight: 400,
        lineHeight: 21,
        letterSpacing: 0.3,
      },
    ],
  };
  b.recipes = [
    {
      id: "components/Test",
      source: ["released.scss"],
      variants: [{ id: "default", root }],
    },
  ];
  augmentTypographyBindings(b);
  const title = root.children[0];
  const style = b.styles.find((s: any) => s.id === title.textStyle);
  assert.equal(style.fontSize, 14);
  assert.equal(style.lineHeight, 16);
  assert.notEqual(title.textStyle, "text-body-medium-strong");
  const odd: any = root.children[1];
  const oddStyle = b.styles.find((s: any) => s.id === odd.textStyle);
  assert.equal(oddStyle.fontSize, 17);
  assert.equal(oddStyle.lineHeight, 21);
  assert.equal(oddStyle.letterSpacing, 0.3);
  const token = b.tokens.find((t: any) => t.id === odd.bindings.fontSize);
  assert.equal(token.values.Value, 17);
  assert.ok(token.provenance);
});
test("native font family aliases preserve source CSS stacks and resolve actual families at import", () => {
  const b = structuredClone(source);
  const original = b.tokens.find(
    (t: any) => t.id === "typography-font-family-primary",
  ).values.Value;
  augmentTypographyBindings(b);
  assert.equal(
    b.tokens.find((t: any) => t.id === "typography-font-family-primary").values
      .Value,
    original,
  );
  const alias = b.tokens.find(
    (t: any) => t.id === "native-font-family-diatype",
  );
  assert.equal(alias.type, "STRING");
  assert.equal(alias.values.Value, "Diatype");
  assert.deepEqual(alias.nativeFontFamily, {
    sourceFamily: "Diatype",
    style: "Regular",
  });
  assert.ok(alias.scopes.includes("FONT_FAMILY"));
});
