import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
// @ts-ignore authored dependency-free compositions
import * as examplesModule from "../recipes/examples.mjs";
const {
  patterns,
  screens,
  additionalPatterns,
  additionalScreens,
  additionalImageSlots,
} = examplesModule;
const demo = JSON.parse(
  fs.readFileSync(new URL("../fixtures/demo.json", import.meta.url), "utf8"),
);
const walk = (node: any, fn: (n: any) => void) => {
  fn(node);
  for (const [id, override] of Object.entries(node.instanceOverrides ?? {}))
    fn({ id, ...(override as any) });
  for (const child of node.children ?? []) walk(child, fn);
};
const resolvePattern = (node: any): any => {
  if (
    node.kind !== "componentInstance" ||
    !node.recipeId?.startsWith("patterns/")
  )
    return node;
  const recipe = [...patterns, ...additionalPatterns].find(
    (r: any) => r.id === node.recipeId,
  );
  const variant = recipe?.variants.find((v: any) =>
    Object.entries(node.variantProps ?? {}).every(
      ([key, value]) => v.props[key] === value,
    ),
  );
  assert.ok(variant, "Missing linked pattern " + node.recipeId);
  return variant.root;
};
const walkPatterns = (node: any, fn: (n: any) => void) => {
  const root = resolvePattern(node);
  fn(root);
  for (const [id, override] of Object.entries(root.instanceOverrides ?? {}))
    fn({ id, ...(override as any) });
  for (const child of root.children ?? []) walkPatterns(child, fn);
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
  // @ts-ignore authored ESM
  const { default: media } = await import("../recipes/media-components.mjs");
  const source = [
    ...base,
    ...controls,
    ...foundations,
    ...complex,
    ...media,
    ...patterns,
    ...additionalPatterns,
  ];
  for (const root of [
    ...[...screens, ...additionalScreens].map((s: any) => s.root),
    ...[...patterns, ...additionalPatterns].flatMap((p: any) =>
      p.variants.map((v: any) => v.root),
    ),
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
      v.props.viewport.endsWith("mobile")
        ? ["colors", "fonts"].includes(v.props.page)
          ? 48
          : v.props.page === "brands"
            ? 54
            : 122
        : 54,
    );
    let linkedInputs = 0;
    walk(v.root, (n: any) => {
      if (n.componentName === "TextInput") {
        linkedInputs++;
        assert.equal(
          n.strokeWeight,
          0,
          "Unboxed search uses a base input with its border overridden.",
        );
      }
    });
    assert.equal(
      linkedInputs,
      1,
      "Observed search must use a canonical TextInput instance.",
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

test("additional observed product surfaces preserve the original twelve IDs and exclude a Marketplace screen", async () => {
  assert.equal(additionalPatterns.length, 10);
  assert.equal(additionalScreens.length, 22);
  assert.ok(additionalPatterns.every((p: any) => p.variants.length <= 30));
  assert.ok(!additionalScreens.some((s: any) => /marketplace/i.test(s.name)));
  const all = [...screens, ...additionalScreens];
  assert.equal(new Set(all.map((s: any) => s.id)).size, 34);
  for (const screen of additionalScreens)
    assert.ok([1728, 1024, 390].includes(screen.width));
});

test("observed drawer, overlay and palette constraints remain explicit native geometry", async () => {
  const recipe = (name: string, props: any) =>
    additionalPatterns
      .find((r: any) => r.name === name)
      .variants.find((v: any) =>
        Object.entries(props).every(([k, value]) => v.props[k] === value),
      ).root;
  const drawer = recipe("ProductionNotificationsDrawer", {
    viewport: "mobile",
  });
  assert.equal(drawer.width, 401);
  assert.equal(drawer.height, 775);
  const settings = additionalScreens.find(
    (s: any) => s.id === "examples/production-account-settings-desktop",
  );
  assert.equal(
    settings.root.children.find((n: any) => n.id === "drawer").x,
    257,
  );
  const help = additionalScreens.find(
    (s: any) => s.id === "examples/production-help-mobile",
  );
  const dialog = help.root.children.find((n: any) => n.id === "dialog");
  assert.deepEqual([dialog.x, dialog.y], [16, 235]);
  const search = recipe("ProductionGlobalSearch", {
    viewport: "mobile",
    state: "blank",
  });
  assert.equal(search.width, 358);
  assert.equal(search.children.length, 1);
  const palette = recipe("ProductionEssentialsPaletteList", {
    viewport: "mobile",
    state: "expanded",
  });
  let wideTable = false;
  walk(palette, (n: any) => {
    if (n.id === "columns" && n.width === 760) wideTable = true;
  });
  assert.ok(
    wideTable,
    "Mobile uses the observed dense table instead of an invented stacked-card transformation",
  );
});

test("actual image slots reference committed media while functional icons, font samples and palette content stay native", async () => {
  const manifest = JSON.parse(
    fs.readFileSync(
      new URL("../fixtures/media/manifest.json", import.meta.url),
      "utf8",
    ),
  );
  const ids = new Set(manifest.assets.map((a: any) => a.id));
  let count = 0;
  const usedImages = new Set<string>();
  for (const root of [...patterns, ...additionalPatterns]
    .flatMap((r: any) => r.variants.map((v: any) => v.root))
    .concat([...screens, ...additionalScreens].map((s: any) => s.root)))
    walkPatterns(root, (n: any) => {
      assert.ok(!n.pendingSourceImage, n.id);
      if (!n.imageAssetId) return;
      count++;
      usedImages.add(n.imageAssetId);
      assert.ok(ids.has(n.imageAssetId));
      assert.equal(n.fill, undefined);
      assert.equal(n.bindings?.fills, undefined);
      assert.equal(n.imageScaleMode, "FILL");
    });
  assert.ok(count >= 90);
  assert.deepEqual([...usedImages].sort(), [...ids].sort());
  assert.ok(
    additionalImageSlots.every((slot: any) => slot.status === "available"),
  );
  const brand = patterns.find((r: any) => r.name === "ProductionBrandCard")
    .variants[0].root.children[0];
  assert.equal(brand.kind, "componentInstance");
  assert.equal(brand.recipeId, "components/Card.BannerImage");
  assert.ok(brand.instanceOverrides.image.imageAssetId);
  assert.equal(
    brand.children,
    undefined,
    "Image content is an override of the canonical banner anatomy.",
  );
});

test("reviewed Essentials navigation, palette columns and result previews preserve measured constraints", () => {
  const colors = additionalScreens.find(
    (s: any) =>
      s.id === "examples/production-essentials-colors-collapsed-mobile",
  );
  const header = resolvePattern(
    colors.root.children
      .find((n: any) => n.id === "main")
      .children.find((n: any) => n.id === "page-header"),
  );
  assert.equal(header.height, 96);
  assert.equal(
    header.children.find((n: any) => n.id === "title-action").height,
    60,
  );
  const tabs = header.children.find((n: any) => n.id === "tabs");
  assert.equal(
    tabs.children.find((n: any) => n.id === "tab-colors").bindings.fills,
    "color-container-secondary-default",
  );
  assert.equal(
    tabs.children.find((n: any) => n.id === "tab-fonts").bindings,
    undefined,
  );
  const palette = additionalPatterns
    .find((r: any) => r.name === "ProductionEssentialsPaletteList")
    .variants.find(
      (v: any) => v.props.viewport === "mobile" && v.props.state === "expanded",
    ).root;
  const table = palette.children[1].children.find(
    (n: any) => n.id === "color-table",
  );
  for (const row of table.children.filter((n: any) => n.id !== "add-color"))
    assert.deepEqual(
      row.children.map((n: any) => n.width),
      [218, 104, 144, 246],
    );
  assert.equal(
    table.children.find((n: any) => n.id === "add-color").componentName,
    "Button",
  );
  const search = additionalPatterns
    .find((r: any) => r.name === "ProductionGlobalSearch")
    .variants.find((v: any) => v.props.state === "results").root;
  let previews = 0;
  walk(search, (n: any) => {
    if (n.id === "preview") {
      previews++;
      assert.equal(n.width, 60);
      assert.equal(n.height, 60);
    }
  });
  assert.equal(previews, 3);
});

test("all observed example navigation and shared chrome resolve library instances", () => {
  let rails = 0,
    bars = 0;
  for (const screen of additionalScreens) {
    for (const child of screen.root.children) {
      if (["rail", "mobile-bar"].includes(child.id)) {
        assert.equal(
          child.kind,
          "componentInstance",
          screen.id + "/" + child.id,
        );
        const root = resolvePattern(child);
        assert.equal(root.width, child.id === "rail" ? 257 : 390);
        assert.equal(root.height, child.id === "rail" ? screen.height : 68);
        if (child.id === "rail") rails++;
        else bars++;
      }
      if (child.id === "main") {
        for (const item of child.children.filter((n: any) =>
          ["page-header", "search-toolbar", "essentials-toolbar"].includes(
            n.id,
          ),
        )) {
          assert.equal(
            item.kind,
            "componentInstance",
            screen.id + "/" + item.id,
          );
          assert.equal(
            resolvePattern(item).width,
            screen.width === 390 ? 390 : screen.width - 257,
          );
        }
      }
    }
  }
  assert.equal(rails, 13);
  assert.equal(bars, 9);
});

test("navigation search composes base input and preserves its keyboard shortcut", () => {
  const rail = patterns.find((r: any) => r.name === "ProductionNavigationRail");
  let checked = 0;
  for (const variant of rail.variants) {
    const input = variant.root.children.find(
      (n: any) => n.id === "navigation-search",
    );
    if (!input) continue;
    assert.equal(input.kind, "componentInstance");
    assert.equal(input.componentName, "TextInput");
    const shortcut = variant.root.children.find(
      (n: any) => n.id === "navigation-search-shortcut",
    );
    assert.equal(shortcut.componentName, "Text");
    assert.equal(shortcut.text, "⌘K");
    assert.equal(shortcut.layoutPositioning, "ABSOLUTE");
    assert.equal(shortcut.x, input.x + input.width - 32);
    checked++;
  }
  assert.ok(checked > 0);
});
