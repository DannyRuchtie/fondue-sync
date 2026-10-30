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
test("production examples cover three observed pages at desktop and mobile widths with explicit empty-state profiles", () => {
  assert.equal(screens.length, 12);
  assert.equal(patterns.length, 8);
  const ids = new Set(patterns.map((p: any) => p.id));
  for (const page of ["brands", "guidelines", "libraries"])
    for (const viewport of ["wide", "desktop", "mobile"])
      assert.ok(
        screens.some(
          (s: any) =>
            s.id === `examples/production-${page}-populated-${viewport}`,
        ),
      );
  for (const s of screens) {
    assert.equal(s.root.kind, "frame");
    assert.equal(s.root.width, s.width);
    assert.ok([1920, 1440, 768, 390].includes(s.width));
    let instances = 0;
    walk(s.root, (n: any) => {
      if (n.kind === "componentInstance") {
        instances++;
        if (n.recipeId) assert.ok(ids.has(n.recipeId));
      }
    });
    assert.ok(instances >= 3);
    assert.ok(s.productionReference.method.includes("Read-only"));
  }
  for (const p of patterns) {
    assert.ok(p.documentation.origin.includes("Authored"));
    for (const v of p.variants) {
      let count = 0;
      walk(v.root, (n: any) => {
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
test("production card and toolbar profiles retain measured geometry rather than a universal desktop size", () => {
  const card = patterns.find(
    (p: any) => p.id === "patterns/ProductionBrandCard",
  );
  assert.equal(
    card.variants.find((v: any) => v.props.viewport === "wide").root.width,
    310.2,
  );
  assert.equal(
    card.variants.find((v: any) => v.props.viewport === "desktop").root.width,
    271.75,
  );
  assert.equal(
    card.variants.find((v: any) => v.props.viewport === "mobile").root.width,
    342,
  );
  const toolbar = patterns.find(
    (p: any) => p.id === "patterns/ProductionSearchToolbar",
  );
  for (const v of toolbar.variants) {
    assert.equal(
      v.root.height,
      v.props.viewport === "mobile"
        ? v.props.page === "brands"
          ? 54
          : 122
        : 54,
    );
    let boxedInputs = 0;
    walk(v.root, (n: any) => {
      if (n.componentName === "TextInput") boxedInputs++;
    });
    assert.equal(
      boxedInputs,
      0,
      "Observed search is unboxed and must not inherit a default bordered TextInput.",
    );
  }
  const empty = patterns.find(
    (p: any) => p.id === "patterns/ProductionLibrariesEmptyState",
  );
  for (const v of empty.variants) {
    const display = v.root.children.find((n: any) => n.id === "display-title");
    assert.equal(display.fontFamily, "Cranny");
    assert.equal(display.fontWeight, 300);
    assert.equal(display.fontSize, 46);
    assert.equal(display.lineHeight, 54);
  }
});

test("reviewed production affordances retain measured search, footer and empty-panel geometry", () => {
  const find = (name: string, props: Record<string, string>) =>
    patterns
      .find((p: any) => p.name === name)
      .variants.find((v: any) =>
        Object.entries(props).every(([k, value]) => v.props[k] === value),
      ).root;
  const search = find("ProductionSearchToolbar", {
    page: "libraries",
    viewport: "mobile",
  });
  assert.equal(
    search.children.find((n: any) => n.id === "unboxed-search").x,
    24,
  );
  const divider = search.children.find((n: any) => n.id === "search-divider");
  assert.deepEqual([divider.x, divider.y, divider.height], [200, 31, 80]);
  assert.equal(search.bindings.strokes, undefined);
  const library = find("ProductionLibraryCard", { viewport: "wide" });
  assert.equal(library.children.find((n: any) => n.id === "footer").gap, 12);
  const empty = find("ProductionLibrariesEmptyState", { viewport: "wide" });
  assert.equal(
    empty.children.find((n: any) => n.id === "description").textAlignHorizontal,
    "CENTER",
  );
  const illustration = empty.children[0];
  assert.equal(illustration.height, 220);
  assert.equal(
    illustration.children.find((n: any) => n.id === "video-card").rotation,
    8,
  );
  assert.equal(
    illustration.children.find((n: any) => n.id === "logo-card").rotation,
    -14,
  );
  const bar = find("ProductionMobileBrandBar", { page: "brands" });
  assert.equal(bar.paddingLeft, 20);
  assert.equal(
    bar.children
      .find((n: any) => n.id === "utilities")
      .children.find((n: any) => n.id === "account-more").gap,
    4,
  );
});
