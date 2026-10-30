import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
// @ts-expect-error Node-only adapter, consumed by the companion service.
import { createTokenAuthoringAdapter } from "../scripts/push-tokens.mjs";
const builder = "packages/tokens/src/styleDictionary/buildStyleDictionary.ts";
const bundle = {
  tokens: [
    {
      id: "border-radius-medium",
      css: "var(--border-radius-medium)",
      type: "FLOAT",
      values: { Value: 4 },
    },
  ],
};
async function fixture(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "fondue-tokens-"));
  try {
    for (const [path, text] of [
      [
        builder,
        "export const buildStyleDictionary = () => new StyleDictionary({source: [allTokensPath]});",
      ],
      [
        "packages/tokens/dist/manifest.json",
        JSON.stringify({
          tokens: [
            {
              id: "border-radius-medium",
              category: "semantic",
              keyPath: ["semantic", "border-radius", "medium"],
            },
          ],
        }),
      ],
    ]) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), text);
    }
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
const radius = {
  id: "new:radius",
  name: "radius",
  type: "FLOAT",
  existing: false,
  values: { Value: 10 },
};
test("new tokens produce durable source and a persistent build hook with correct rem conversion inputs", async () =>
  fixture(async (sourceRoot) => {
    const result = await createTokenAuthoringAdapter({ bundle }).generate({
      sourceRoot,
      tokens: [radius],
      tokenNames: { "new:radius": "border-radius-custom" },
    });
    const authored = JSON.parse(result.files[0].after);
    assert.equal(authored.default["border-radius"].custom.value, 10);
    assert.equal(
      authored.default["border-radius"].custom.attributes.unit,
      "rem",
    );
    assert.ok(
      result.files[1].after.includes(
        "new URL('../../repository-tokens.json', import.meta.url).pathname",
      ),
    );
    assert.equal(result.files[0].before, null);
  }));
test("theme colors preserve both modes and aliases reference canonical CSS names", async () =>
  fixture(async (sourceRoot) => {
    const tokens = [
      radius,
      {
        id: "new:alias",
        name: "alias",
        type: "FLOAT",
        existing: false,
        values: { Value: { alias: radius.id } },
      },
      {
        id: "new:color",
        name: "color",
        type: "COLOR",
        existing: false,
        values: {
          Light: { r: 1, g: 0, b: 0 },
          Dark: { r: 0, g: 0, b: 1, a: 0.5 },
        },
      },
    ];
    const result = await createTokenAuthoringAdapter({ bundle }).generate({
      sourceRoot,
      tokens,
      tokenNames: {
        "new:radius": "border-radius-custom",
        "new:alias": "border-radius-alias",
        "new:color": "color-custom",
      },
    });
    const authored = JSON.parse(result.files[0].after);
    assert.equal(
      authored.default["border-radius"].alias.value,
      "ref_border-radius-custom",
    );
    assert.equal(authored.light.color.custom.attributes.type, "theme");
    assert.equal(authored.dark.color.custom.value.a, 0.5);
  }));
test("rejects token collisions, alias cycles, invalid values and missing theme modes", async () =>
  fixture(async (sourceRoot) => {
    const adapter = createTokenAuthoringAdapter({ bundle });
    await assert.rejects(
      adapter.generate({
        sourceRoot,
        tokens: [radius],
        tokenNames: { "new:radius": "border-radius-medium" },
      }),
      /already exists/,
    );
    await assert.rejects(
      adapter.generate({
        sourceRoot,
        tokens: [{ ...radius, values: { Value: -1 } }],
        tokenNames: { "new:radius": "border-radius-custom" },
      }),
      /non-negative/,
    );
    await assert.rejects(
      adapter.generate({
        sourceRoot,
        tokens: [{ ...radius, values: { Value: { alias: radius.id } } }],
        tokenNames: { "new:radius": "border-radius-custom" },
      }),
      /cycle/,
    );
    await assert.rejects(
      adapter.generate({
        sourceRoot,
        tokens: [
          { ...radius, type: "COLOR", values: { Light: { r: 0, g: 0, b: 0 } } },
        ],
        tokenNames: { "new:radius": "color-custom" },
      }),
      /both Light and Dark/,
    );
  }));
test("build hook is idempotent and a renamed builder fails rather than guessing", async () =>
  fixture(async (sourceRoot) => {
    const adapter = createTokenAuthoringAdapter({ bundle });
    const first = await adapter.generate({
      sourceRoot,
      tokens: [radius],
      tokenNames: { "new:radius": "border-radius-custom" },
    });
    await writeFile(join(sourceRoot, builder), first.files[1].after);
    const second = await adapter.generate({
      sourceRoot,
      tokens: [radius],
      tokenNames: { "new:radius": "border-radius-custom" },
    });
    assert.equal(second.files.length, 1);
    await writeFile(
      join(sourceRoot, builder),
      "new StyleDictionary({ source: someNewPipeline })",
    );
    await assert.rejects(
      adapter.generate({
        sourceRoot,
        tokens: [radius],
        tokenNames: { "new:radius": "border-radius-custom" },
      }),
      /source changed/,
    );
  }));
test("existing primitive colors retain their canonical authoring path when omitted from SDK manifest", async () =>
  fixture(async (sourceRoot) => {
    const color = {
      id: "color-neutral-10",
      name: "color/neutral/10",
      css: "var(--color-neutral-10)",
      type: "COLOR",
      existing: true,
      values: { Value: { r: 0.1, g: 0.1, b: 0.1, a: 1 } },
    };
    const result = await createTokenAuthoringAdapter({
      bundle: { tokens: [color] },
    }).generate({ sourceRoot, tokens: [color] });
    const tree = JSON.parse(result.files[0].after);
    assert.equal(tree.default.color.neutral["10"].value.r, 0.1);
    assert.equal(tree.default.color["neutral-10"], undefined);
  }));
test("shared-token three-way check preserves unrelated token edits and blocks same-token upstream drift", async () =>
  fixture(async (sourceRoot) => {
    const baselineRoot = join(sourceRoot, "baseline");
    const base = "packages/tokens/dist/css/base.css",
      themes = "packages/tokens/dist/themes/themes.module.css";
    for (const file of [base, themes])
      for (const root of [sourceRoot, baselineRoot]) {
        await mkdir(dirname(join(root, file)), { recursive: true });
        await writeFile(
          join(root, file),
          ":root { --border-radius-medium: 0.25rem; --spacing-other: 1rem; }",
        );
      }
    await writeFile(
      join(sourceRoot, base),
      ":root { --border-radius-medium: 0.25rem; --spacing-other: 2rem; }",
    );
    const adapter = createTokenAuthoringAdapter({ bundle });
    const tokens = [
      { ...bundle.tokens[0], existing: true, values: { Value: 8 } },
    ];
    const result = await adapter.generate({ sourceRoot, baselineRoot, tokens });
    assert.ok(result.files.length > 0);
    await writeFile(
      join(sourceRoot, base),
      ":root { --border-radius-medium: 0.5rem; --spacing-other: 2rem; }",
    );
    await assert.rejects(
      adapter.generate({ sourceRoot, baselineRoot, tokens }),
      /Upstream token border-radius-medium changed/,
    );
  }));
