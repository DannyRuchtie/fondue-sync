import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
// @ts-expect-error Source-controlled native recipe module.
import mediaRecipes from "../recipes/media-components.mjs";
// @ts-expect-error Existing source-controlled native recipes.
import existingPatterns from "../recipes/patterns.mjs";
const root = new URL(
  "../.cache/release/packages/components/src/components/",
  import.meta.url,
);
const source = (path: string) => fs.readFileSync(new URL(path, root), "utf8");
const walk = (n: any): any[] => [n, ...(n.children ?? []).flatMap(walk)];
const recipe = (id: string) =>
  mediaRecipes.find((r: any) => r.id === "components/" + id);

test("public Card image exports retain exact fit, padding and source-ratio geometry", () => {
  const api = source("Card/Card.ts");
  assert.match(api, /BannerImage: forwardRef/);
  assert.match(api, /ThumbnailImage: forwardRef/);
  const bannerSource = source("Card/CardBanner.tsx");
  assert.match(bannerSource, /CardBannerFit = 'cover' \| 'contain'/);
  assert.match(
    bannerSource,
    /CardBannerImagePadding = 'none' \| 'small' \| 'medium' \| 'large'/,
  );
  const css = source("Card/styles/card.module.scss");
  assert.match(css, /aspect-ratio: 3 \/ 1/);
  assert.match(css, /aspect-ratio: 9 \/ 6/);
  for (const [prop, token] of [
    ["small", "small"],
    ["medium", "large"],
    ["large", "x-large"],
  ])
    assert.ok(
      css.includes(
        `&[data-padding='${prop}'] {\n        padding: var(--spacing-${token});`,
      ),
    );
  const banner = recipe("Card.BannerImage");
  assert.equal(banner.variants.length, 16);
  assert.equal(new Set(banner.variants.map((v: any) => v.id)).size, 16);
  for (const v of banner.variants) {
    const root = v.root,
      pic = root.children[0];
    const padding = { none: 0, small: 12, medium: 24, large: 32 }[
      v.props.padding as "none" | "small" | "medium" | "large"
    ];
    assert.equal(root.width, 240);
    assert.equal(root.height, v.props.size === "small" ? 80 : 160);
    assert.equal(pic.width, root.width - 2 * padding);
    assert.equal(pic.height, root.height - 2 * padding);
    assert.equal(pic.imageScaleMode, v.props.fit === "cover" ? "FILL" : "FIT");
    assert.equal(root.padding, padding);
    const token = {
      none: "component-constant-spacing-0",
      small: "spacing-small",
      medium: "spacing-large",
      large: "spacing-x-large",
    }[v.props.padding as "none" | "small" | "medium" | "large"];
    assert.equal(root.bindings.paddingLeft, token);
  }
  assert.match(css, /\.thumbnailImage\s*\{\s*object-fit: contain/);
  const thumb = recipe("Card.ThumbnailImage").variants[0].root;
  assert.deepEqual([thumb.width, thumb.height], [40, 40]);
  assert.equal(thumb.children[0].imageScaleMode, "FIT");
  assert.equal(thumb.bindings.cornerRadius, "border-radius-medium");
});

test("AssetInput image preview uses the actual orientation/open API and single-image CSS dimensions", () => {
  assert.match(source("AssetInput/AssetInput.tsx"), /PreviewImage: forwardRef/);
  assert.match(source("AssetInput/AssetInputRoot.tsx"), /isOpen\?: boolean/);
  assert.match(
    source("AssetInput/AssetInputRoot.tsx"),
    /orientation\?: AssetInputOrientation/,
  );
  const css = source("AssetInput/styles/asset-input.module.scss");
  assert.match(css, /width: sizeToken\.get\(14\)/);
  assert.match(css, /height: sizeToken\.get\(32\)/);
  const input = recipe("AssetInput/image-preview");
  assert.equal(input.variants.length, 4);
  for (const v of input.variants) {
    assert.deepEqual(Object.keys(v.props), ["orientation", "isOpen"]);
    const preview = v.root.children.find((n: any) => n.id === "preview");
    assert.equal(preview.height, v.props.orientation === "vertical" ? 128 : 56);
    if (v.props.orientation === "horizontal") assert.equal(preview.width, 56);
    assert.equal(preview.children[0].imageScaleMode, "FIT");
    assert.equal(
      v.root.bindings.strokes,
      v.props.isOpen === "true" ? "color-line-strong" : "color-line-mid",
    );
    const caret = walk(v.root).find((n) => n.id === "caret-icon");
    assert.equal(
      caret.iconId,
      v.props.isOpen === "true" ? "icon:caret-up" : "icon:caret-down",
    );
  }
});

test("image recipes use approved real bytes while retaining all functional icon and PDF recipe identities", () => {
  const manifest = JSON.parse(
    fs.readFileSync(
      new URL("../fixtures/media/manifest.json", import.meta.url),
      "utf8",
    ),
  );
  const used = new Set<string>();
  const prior = new Set(existingPatterns.map((r: any) => r.id));
  for (const r of mediaRecipes) {
    assert.equal(prior.has(r.id), false);
    assert.equal(r.status, "partial");
    assert.ok(r.variants.length < 30);
    for (const v of r.variants)
      for (const n of walk(v.root))
        if (n.imageAssetId) {
          used.add(n.imageAssetId);
          const asset = manifest.assets.find(
            (a: any) => a.id === n.imageAssetId,
          );
          assert.ok(asset);
          const bytes = fs.readFileSync(
            new URL("../fixtures/media/" + asset.file, import.meta.url),
          );
          assert.equal(
            crypto.createHash("sha256").update(bytes).digest("hex"),
            asset.sha256,
          );
          assert.ok(["FILL", "FIT"].includes(n.imageScaleMode));
          assert.equal(n.svg, undefined);
        }
  }
  assert.equal(used.size, 6);
  for (const id of [
    "components/Card.BannerIcon",
    "components/Card.ThumbnailIcon",
    "components/AssetInput",
  ]) {
    const r = existingPatterns.find((r: any) => r.id === id);
    assert.ok(r);
    assert.equal(
      r.variants.some((v: any) => walk(v.root).some((n) => n.imageAssetId)),
      false,
    );
  }
});
