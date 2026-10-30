import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
// @ts-ignore source reviewed ESM augmentation
import { augmentPaintBindings } from "../recipes/paint-bindings.mjs";
const released = JSON.parse(
  fs.readFileSync(
    new URL("../bundles/fondue-13.11.1.json", import.meta.url),
    "utf8",
  ),
);
function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fondue-paints-"));
  const dir = path.join(root, "packages/components/src/utilities");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "shadow.module.scss"),
    "@mixin shadow-md {\n & {box-shadow: 0 3px 10px 0 rgba(8, 8, 8, 0.15);}\n}\n@mixin shadow-lg {\n & {box-shadow: 0px 25px 80px 0px rgba(8, 8, 8, 0.2);}\n}\n",
  );
  const bundle: any = {
    release: "13.11.1",
    tokens: structuredClone(
      released.tokens.filter((t: any) => !t.id.startsWith("source-shadow")),
    ),
    styles: structuredClone(
      released.styles.filter(
        (s: any) => s.type === "EFFECT" && !s.id.startsWith("source-"),
      ),
    ),
    icons: [{ id: "icon:test" }],
    examples: [],
    recipes: [],
  };
  return {
    root,
    bundle,
    clean: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}
const recipe = (id: string, root: any) => ({
  id,
  name: id,
  variants: [{ id: "default", props: {}, root }],
});
test("shadow utilities create exact source styles with every native effect field bound to correct typed roles", () => {
  const f = setup();
  try {
    const report = augmentPaintBindings(f.bundle, { sourceRoot: f.root });
    const md = f.bundle.styles.find((s: any) => s.id === "source-shadow-md");
    assert.equal(md.effects[0].color.a, 0.15);
    assert.equal(md.effects[0].color.r, 8 / 255);
    assert.equal(md.effects[0].radius, 10);
    assert.equal(md.effects[0].offset.y, 3);
    assert.equal(
      md.source,
      "packages/components/src/utilities/shadow.module.scss",
    );
    const tokens = new Map(f.bundle.tokens.map((t: any) => [t.id, t]));
    for (const style of f.bundle.styles)
      for (const map of style.effectBindings) {
        assert.deepEqual(Object.keys(map).sort(), [
          "color",
          "offsetX",
          "offsetY",
          "radius",
          "spread",
        ]);
        for (const [field, id] of Object.entries(map)) {
          const token: any = tokens.get(id);
          assert.equal(token.type, field === "color" ? "COLOR" : "FLOAT");
          assert.ok(
            token.scopes.includes(
              field === "color" ? "EFFECT_COLOR" : "EFFECT_FLOAT",
            ),
          );
        }
      }
    assert.equal(report.counts.derivedEffectStyles, 4);
  } finally {
    f.clean();
  }
});
test("source shadow/focus composites become native shared style links with exact metrics", () => {
  const f = setup();
  try {
    f.bundle.recipes = [
      recipe("components/Flyout", {
        id: "root",
        kind: "frame",
        effects: [
          {
            type: "DROP_SHADOW",
            color: { r: 8 / 255, g: 8 / 255, b: 8 / 255, a: 0.15 },
            offset: { x: 0, y: 3 },
            radius: 10,
            spread: 0,
            visible: true,
            blendMode: "NORMAL",
          },
        ],
        children: [
          {
            id: "focus",
            kind: "frame",
            focusRing: {
              inner: "color-surface-default",
              outer: "color-focus-default",
              innerSpread: 2,
              outerSpread: 6,
            },
          },
        ],
      }),
    ];
    augmentPaintBindings(f.bundle, { sourceRoot: f.root });
    assert.equal(
      f.bundle.recipes[0].variants[0].root.effectStyle,
      "source-shadow-md",
    );
    assert.ok(!f.bundle.recipes[0].variants[0].root.effects);
    assert.equal(
      f.bundle.recipes[0].variants[0].root.children[0].effectStyle,
      "source-focus-outline",
    );
    const focus = f.bundle.styles.find(
      (s: any) => s.id === "source-focus-outline",
    );
    assert.deepEqual(
      focus.effects.map((e: any) => e.spread),
      [2, 6],
    );
  } finally {
    f.clean();
  }
});
test("SVG paint role bindings preserve exact source markup and remove resize implicit fill via metadata", () => {
  const f = setup();
  try {
    const svg = '<svg><path fill="#6acb75"/><path fill="#d59bff"/></svg>';
    const resize = '<svg><path d="m11 3-8 8" stroke="#808080"/></svg>';
    f.bundle.recipes = [
      recipe("charts/PieChart", { id: "segments", kind: "svg", svg }),
      recipe("components/Textarea/one", {
        id: "resize-handle",
        kind: "svg",
        svg: resize,
      }),
    ];
    const report = augmentPaintBindings(f.bundle, { sourceRoot: f.root });
    const chart = f.bundle.recipes[0].variants[0].root;
    assert.equal(chart.svg, svg);
    assert.deepEqual(
      chart.svgPaintBindings.map((p: any) => p.tokenId),
      ["color-charts-primary-default", "color-charts-secondary-default"],
    );
    const handle = f.bundle.recipes[1].variants[0].root;
    assert.equal(handle.svg, resize);
    assert.equal(handle.svgFillNone, true);
    assert.equal(handle.svgPaintBindings[0].tokenId, "color-line-mid");
    assert.ok(handle.clearSvgRootFills);
    assert.equal(report.exceptions.length, 0);
  } finally {
    f.clean();
  }
});
test("literal matching is exact and keeps data artwork and picker gradients explicit", () => {
  const f = setup();
  try {
    f.bundle.recipes = [
      recipe("components/Test", {
        id: "root",
        kind: "frame",
        fill: "#ffffff",
        children: [{ id: "unknown", kind: "rectangle", fill: "#123457" }],
      }),
      recipe("patterns/Artwork", {
        id: "art",
        kind: "rectangle",
        fill: "#CFE6D3",
      }),
      recipe("components/ColorPicker", {
        id: "gradient",
        kind: "svg",
        svg: '<svg><defs><linearGradient><stop stop-color="red"/></linearGradient></defs><rect fill="url(#h)"/></svg>',
      }),
    ];
    const report = augmentPaintBindings(f.bundle, { sourceRoot: f.root });
    const root = f.bundle.recipes[0].variants[0].root;
    const token = f.bundle.tokens.find(
      (t: any) => t.id === root.bindings.fills,
    );
    assert.deepEqual(token.values.Value, { r: 1, g: 1, b: 1, a: 1 });
    assert.ok(!root.children[0].bindings);
    assert.ok(
      report.exceptions.some((e: any) => e.kind === "unmatched-source-literal"),
    );
    assert.ok(report.exceptions.some((e: any) => e.kind === "fixture-artwork"));
    assert.ok(
      report.exceptions.some((e: any) => e.kind === "picker-data-gradient"),
    );
    assert.equal(f.bundle.icons[0].defaultColorToken, "color-primary-default");
  } finally {
    f.clean();
  }
});
