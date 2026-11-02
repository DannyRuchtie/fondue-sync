import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  decodeImageBase64,
  imageSha256,
  validatedImageBytes,
} from "../src/images";
import { bundleProblems } from "../src/preflight";
import type { Bundle, ImageAsset } from "../src/schema";
import {
  loadImageAssets,
  enrichImageReferences,
} from "../scripts/image-assets.mjs";
const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jwGQAAAAASUVORK5CYII=";
const asset: ImageAsset = {
  id: "photo",
  base64: png,
  sha256: crypto
    .createHash("sha256")
    .update(Buffer.from(png, "base64"))
    .digest("hex"),
  mimeType: "image/png",
  width: 1,
  height: 1,
};
const tiny = (): Bundle => ({
  schemaVersion: 1,
  release: "test",
  fingerprint: "test",
  provenance: {},
  tokens: [],
  styles: [],
  icons: [],
  recipes: [],
  inventory: [],
  gaps: [],
  imageAssets: [{ ...asset }],
  examples: [
    {
      id: "photo",
      name: "Photo",
      root: {
        id: "image",
        name: "Image",
        kind: "rectangle",
        imageAssetId: asset.id,
        imageAssetSha256: asset.sha256,
      },
    },
  ],
});
test("sandbox SHA256/base64 match exact Node bytes, including multi-block padding boundaries", () => {
  for (const length of [1, 2, 3, 55, 56, 63, 64, 65, 1024, 100000]) {
    const bytes = Uint8Array.from({ length }, (_, i) => i % 251);
    assert.equal(
      imageSha256(bytes),
      crypto.createHash("sha256").update(bytes).digest("hex"),
    );
    assert.deepEqual(
      decodeImageBase64(Buffer.from(bytes).toString("base64")),
      bytes,
    );
  }
  assert.throws(() => decodeImageBase64("AB=="), /padding/);
  assert.throws(() => decodeImageBase64("url:https://example.com"), /base64/);
});
test("registry validates exact digest, encoded MIME/dimensions and all refs before import", () => {
  assert.equal(
    validatedImageBytes(asset).length,
    Buffer.from(png, "base64").length,
  );
  assert.deepEqual(bundleProblems(tiny()), []);
  for (const patch of [
    { sha256: "0".repeat(64) },
    { mimeType: "image/jpeg" },
    { width: 5 },
    { base64: "invalid" },
  ])
    assert.throws(() =>
      validatedImageBytes({ ...asset, ...patch } as ImageAsset),
    );
  const missing = tiny();
  missing.imageAssets = [];
  assert(bundleProblems(missing).some((p) => p.code === "missing-image"));
  const stale = tiny();
  stale.examples![0].root.imageAssetSha256 = "f".repeat(64);
  assert(bundleProblems(stale).some((p) => p.code === "image-digest"));
  const conflicting = tiny();
  conflicting.examples![0].root.bindings = { fills: "x" };
  assert(
    bundleProblems(conflicting).some((p) => p.code === "image-fill-conflict"),
  );
  const invalid = tiny();
  Object.assign(invalid.examples![0].root, {
    imageScaleMode: "CROP",
    imageTransform: [
      [1, 0, NaN],
      [0, 1, 0],
    ],
  });
  assert(bundleProblems(invalid).some((p) => p.code === "image-transform"));
});
test("offline image digests also cover image slots overridden inside base component instances", () => {
  const bundle = tiny();
  const slot = { imageAssetId: "photo", imageScaleMode: "FILL" as const };
  bundle.examples![0].root = {
    id: "card-cover",
    name: "Card cover",
    kind: "componentInstance",
    recipeId: "components/Card.BannerImage",
    instanceOverrides: { image: slot },
  };
  delete bundle.imageAssets;
  const coverage = enrichImageReferences(bundle, [asset]);
  assert.equal(coverage.references, 1);
  assert.equal(
    bundle.examples![0].root.instanceOverrides!.image.imageAssetSha256,
    asset.sha256,
  );
  assert.deepEqual(bundle.imageAssets, [asset]);
  assert.throws(
    () => enrichImageReferences(bundle, []),
    /Missing offline image/,
  );
});
test("offline manifest deterministically embeds bytes once and enriches definition digests", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fondue-images-"));
  try {
    fs.writeFileSync(path.join(dir, "photo.png"), Buffer.from(png, "base64"));
    const manifest = path.join(dir, "manifest.json");
    fs.writeFileSync(
      manifest,
      JSON.stringify({
        assets: [
          {
            id: "photo",
            file: "photo.png",
            source: { origin: "user-approved Frontify example imagery" },
          },
        ],
      }),
    );
    const loaded = loadImageAssets(manifest);
    assert.equal(loaded[0].sha256, asset.sha256);
    assert.equal(loaded[0].width, 1);
    const bundle = tiny();
    delete bundle.imageAssets;
    delete bundle.examples![0].root.imageAssetSha256;
    const before = JSON.stringify(bundle.examples);
    enrichImageReferences(bundle, loaded);
    assert.notEqual(JSON.stringify(bundle.examples), before);
    assert.equal(bundle.examples![0].root.imageAssetSha256, asset.sha256);
    assert(!JSON.stringify(bundle.examples).includes(png));
    assert.deepEqual(loadImageAssets(path.join(dir, "absent.json")), []);
    fs.writeFileSync(
      manifest,
      JSON.stringify({ assets: [{ id: "photo", file: "../escape.png" }] }),
    );
    assert.throws(() => loadImageAssets(manifest));
    fs.writeFileSync(
      manifest,
      JSON.stringify({
        assets: [{ id: "photo", file: "photo.png", sha256: "0".repeat(64) }],
      }),
    );
    assert.throws(() => loadImageAssets(manifest), /SHA256/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
