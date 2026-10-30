import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  access,
} from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
// @ts-ignore Native Node companion module.
import { createTokenBuildPreparation } from "../scripts/push-validation.mjs";
const authoring = "packages/tokens/repository-tokens.json";
const prefix = "packages/tokens/dist/";
const manifest = JSON.stringify({ tokens: [] });
async function fixture(run: (sourceRoot: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "fondue-validation-test-"));
  try {
    const values: Record<string, string> = {
      [prefix + "manifest.json"]: manifest,
      [prefix + "json/all-tokens.json"]: "{}",
      [prefix + "css/base.css"]: ":root { --spacing-old: 1rem; }",
      [prefix + "themes/themes.module.css"]: ".base { --spacing-old: 1rem; }",
    };
    for (const [path, value] of Object.entries(values)) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), value);
    }
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
const proposal = {
  tokens: [
    {
      id: "new",
      name: "spacing-new",
      type: "FLOAT",
      existing: false,
      values: { Value: 8 },
    },
  ],
};
const files = [
  {
    path: authoring,
    before: null,
    after: '{"default":{"spacing":{"new":{"value":8}}}}',
  },
];
async function generated(cwd: string, unrelated = false) {
  await writeFile(
    join(cwd, prefix + "manifest.json"),
    JSON.stringify({
      tokens: [{ id: "spacing-new", cssVariable: "var(--spacing-new)" }],
    }),
  );
  await writeFile(
    join(cwd, prefix + "css/base.css"),
    `:root { --spacing-old: ${unrelated ? 2 : 1}rem; --spacing-new: 0.5rem; }`,
  );
  await writeFile(
    join(cwd, prefix + "themes/themes.module.css"),
    ".base { --spacing-old: 1rem; --spacing-new: 0.5rem; }",
  );
  await writeFile(
    join(cwd, prefix + "json/all-tokens.json"),
    '{"spacing-new":8}',
  );
}
test("token proposals block without explicit Figma credential or matching toolchain", async () =>
  fixture(async (sourceRoot) => {
    const missing = createTokenBuildPreparation({ figmaToken: "" });
    assert.equal(
      (await missing({ files, sourceRoot, proposal })).issues[0].code,
      "token-build-credentials",
    );
    const toolchain = createTokenBuildPreparation({ figmaToken: "test" });
    assert.equal(
      (await toolchain({ files, sourceRoot, proposal })).issues[0].code,
      "token-build-toolchain",
    );
  }));
test("isolated build captures generated outputs, preserves source, and cleans temp copy", async () =>
  fixture(async (sourceRoot) => {
    let working = "";
    const prepare = createTokenBuildPreparation({
      figmaToken: "test-credential",
      requireToolchain: false,
      execute: async ({ cwd, figmaToken }: any) => {
        working = cwd;
        assert.notEqual(cwd, sourceRoot);
        assert.equal(figmaToken, "test-credential");
        assert.equal(
          await readFile(join(cwd, authoring), "utf8"),
          files[0].after,
        );
        await generated(cwd);
      },
    });
    const result = await prepare({ files, sourceRoot, proposal });
    assert.deepEqual(result.issues, []);
    assert.equal(result.files.length, 5);
    assert.match(result.checks[0], /passed/);
    assert.equal(
      await readFile(join(sourceRoot, prefix + "manifest.json"), "utf8"),
      manifest,
    );
    await assert.rejects(access(join(sourceRoot, authoring)));
    await assert.rejects(access(working));
  }));
test("zero-exit build without exports and unrelated fetched token changes both block submission", async () =>
  fixture(async (sourceRoot) => {
    const incomplete = createTokenBuildPreparation({
      figmaToken: "test",
      requireToolchain: false,
      execute: async () => {},
    });
    assert.equal(
      (await incomplete({ files, sourceRoot, proposal })).issues[0].code,
      "token-build-failed",
    );
    const unrelated = createTokenBuildPreparation({
      figmaToken: "test",
      requireToolchain: false,
      execute: async ({ cwd }: any) => generated(cwd, true),
    });
    assert.match(
      (await unrelated({ files, sourceRoot, proposal })).issues[0].message,
      /Unrelated token changes/,
    );
  }));
test("build failures return blockers without touching source and component-only patches skip token fetch", async () =>
  fixture(async (sourceRoot) => {
    const prepare = createTokenBuildPreparation({
      figmaToken: "test",
      requireToolchain: false,
      execute: async () => {
        throw Error("Token build failed");
      },
    });
    assert.equal(
      (await prepare({ files, sourceRoot, proposal })).issues[0].code,
      "token-build-failed",
    );
    const component = [
      { path: "packages/components/src/Button.tsx", before: "", after: "" },
    ];
    assert.deepEqual(
      await prepare({ files: component, sourceRoot, proposal }),
      { files: component, issues: [], checks: [] },
    );
  }));

test("primitive colors follow CSS-only export contract while themed colors still require manifest exports", async () =>
  fixture(async (sourceRoot) => {
    const value = { r: 0.2, g: 0.3, b: 0.4, a: 1 };
    const color = {
      id: "new-color",
      name: "color-custom",
      type: "COLOR",
      existing: false,
      values: { Value: value },
    };
    const prepare = createTokenBuildPreparation({
      figmaToken: "test",
      requireToolchain: false,
      execute: async ({ cwd }: any) => {
        await writeFile(
          join(cwd, prefix + "css/base.css"),
          ":root { --spacing-old: 1rem; --color-custom: rgba(51, 77, 102, 1); }",
        );
        await writeFile(
          join(cwd, prefix + "themes/themes.module.css"),
          ".base { --spacing-old: 1rem; --color-custom: rgba(51, 77, 102, 1); }",
        );
      },
    });
    const primitive = await prepare({
      files,
      sourceRoot,
      proposal: { tokens: [color] },
    });
    assert.deepEqual(primitive.issues, []);
    assert.ok(
      primitive.files.some(
        (file: any) => file.path === prefix + "css/base.css",
      ),
    );
    const themed = await prepare({
      files,
      sourceRoot,
      proposal: {
        tokens: [{ ...color, values: { Light: value, Dark: value } }],
      },
    });
    assert.match(
      themed.issues[0].message,
      /did not export color-custom in the manifest/,
    );
    const missingCSS = createTokenBuildPreparation({
      figmaToken: "test",
      requireToolchain: false,
      execute: async () => {},
    });
    assert.match(
      (await missingCSS({ files, sourceRoot, proposal: { tokens: [color] } }))
        .issues[0].message,
      /did not export color-custom in CSS/,
    );
  }));
test("duplicate CSS token declarations block ambiguous authoring paths", async () =>
  fixture(async (sourceRoot) => {
    const prepare = createTokenBuildPreparation({
      figmaToken: "test",
      requireToolchain: false,
      execute: async ({ cwd }: any) => {
        await generated(cwd);
        const path = join(cwd, prefix + "css/base.css");
        await writeFile(
          path,
          (await readFile(path, "utf8")).replace(
            "--spacing-new:",
            "--spacing-new: 1rem; --spacing-new:",
          ),
        );
      },
    });
    const result = await prepare({ files, sourceRoot, proposal });
    assert.match(result.issues[0].message, /ambiguous or missing base CSS/);
  }));
