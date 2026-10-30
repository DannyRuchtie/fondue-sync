import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
// @ts-ignore authored dependency-free compositions
import { patterns, screens } from "../recipes/examples.mjs";
const demo = JSON.parse(
  fs.readFileSync(new URL("../fixtures/demo.json", import.meta.url), "utf8"),
);
const walk = (node: any, fn: (n: any) => void) => {
  fn(node);
  for (const child of node.children ?? []) walk(child, fn);
};
test("examples are three editable compositions and reusable native instance patterns", () => {
  assert.deepEqual(
    screens.map((s: any) => s.id),
    ["examples/dashboard", "examples/guidelines", "examples/agentic"],
  );
  assert.equal(patterns.length, 5);
  const ids = new Set(patterns.map((p: any) => p.id));
  for (const s of screens) {
    assert.equal(s.root.kind, "frame");
    assert.equal(s.root.width, 1280);
    let instances = 0;
    walk(s.root, (n) => {
      if (n.kind === "componentInstance") {
        instances++;
        if (n.recipeId) assert.ok(ids.has(n.recipeId));
      }
    });
    assert.ok(instances >= 3);
  }
  for (const p of patterns) {
    assert.ok(p.documentation.origin.includes("Authored"));
    for (const v of p.variants) {
      let count = 0;
      walk(v.root, (n) => {
        if (n.kind === "componentInstance") count++;
      });
      assert.ok(count > 0, p.name);
    }
  }
});
test("fixture bindings point to owned synthetic entities and never carry credentials or private account fixtures", () => {
  for (const root of [
    ...screens.map((s: any) => s.root),
    ...patterns.flatMap((p: any) => p.variants.map((v: any) => v.root)),
  ])
    walk(root, (n) => {
      if (!n.dataBinding) return;
      const b = n.dataBinding;
      assert.equal(b.schemaVersion, 1);
      assert.equal(b.dataset, demo.datasetId);
      assert.equal(b.status, "fixture");
      assert.ok(
        [
          "brands",
          "libraries",
          "assets",
          "guidelines",
          "agenticFeatures",
          "learning",
          "ui",
        ].includes(b.domain),
      );
      if (b.entityId) {
        assert.ok(
          demo[b.domain].some((e: any) => e.id === b.entityId),
          b.entityId,
        );
        assert.ok(
          demo[b.domain].find((e: any) => e.id === b.entityId)[b.field] !==
            undefined,
        );
      }
    });
  const serialized = JSON.stringify({ patterns, screens, demo });
  assert.ok(
    !/superheroes|pizzapie|705|accessToken|apiKey|\/reference\//i.test(
      serialized,
    ),
  );
});
test("future capability registry is explicit about unsupported live behavior and paging permissions", () => {
  const registry = JSON.parse(
    fs.readFileSync(
      new URL("../fixtures/capabilities.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(registry.schemaVersion, 1);
  assert.equal(registry.mode, "fixture-only");
  assert.equal(registry.context.approved, false);
  assert.ok(
    registry.capabilities.every((c: any) => c.status === "future-connected"),
  );
  assert.ok(registry.response.state.includes("permission-required"));
  assert.ok(
    registry.capabilities.some(
      (c: any) =>
        c.id === "assets.search" && c.requestFields.includes("cursor"),
    ),
  );
  assert.ok(registry.excludedPublicParityClaims.includes("agentic execution"));
});
test("example instance selections resolve real released recipe variants", async () => {
  // @ts-ignore authored ESM
  const { default: base } = await import("../recipes/index.mjs"); // @ts-ignore authored ESM
  const { default: controls } = await import("../recipes/controls.mjs"); // @ts-ignore authored ESM
  const { default: foundations } = await import("../recipes/foundations.mjs"); // @ts-ignore authored ESM
  const { default: complex } = await import("../recipes/patterns.mjs");
  const source = [
    ...base,
    ...controls,
    ...foundations,
    ...complex,
    ...patterns,
  ];
  for (const root of [
    ...screens.map((s: any) => s.root),
    ...patterns.flatMap((p: any) => p.variants.map((v: any) => v.root)),
  ])
    walk(root, (n) => {
      if (n.kind !== "componentInstance") return;
      const candidates = source.filter((r: any) =>
        n.recipeId
          ? r.id === n.recipeId
          : r.name.split("/")[0] === n.componentName,
      );
      assert.ok(
        candidates.length > 0,
        `Missing component ${n.componentName ?? n.recipeId}`,
      );
      assert.ok(
        candidates.some((r: any) =>
          r.variants.some((v: any) =>
            Object.entries(n.variantProps ?? {}).every(
              ([k, value]) => String(v.props[k]) === String(value),
            ),
          ),
        ),
        `No matching ${n.componentName ?? n.recipeId}: ${JSON.stringify(n.variantProps)}`,
      );
    });
});
