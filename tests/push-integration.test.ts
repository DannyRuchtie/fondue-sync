import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { inspectSelection } from "../src/push-selection";
import { snapshot } from "../src/snapshot";
import { write, read } from "../src/metadata";
import { generatePushPatch } from "../scripts/push-patches.mjs";
import { declarations } from "../recipes/reverse-mappings.mjs";
import type { Bundle } from "../src/schema";
const releaseRoot = resolve(".cache/release");
const full = JSON.parse(
  await readFile("bundles/fondue-13.11.1.json", "utf8"),
) as Bundle;
function node(id: string, type: string, props: any = {}) {
  const data = new Map<string, string>();
  return {
    id,
    type,
    ...props,
    getSharedPluginData: (ns: string, key: string) => data.get(ns + key) ?? "",
    setSharedPluginData: (ns: string, key: string, value: string) =>
      data.set(ns + key, value),
  } as any;
}
async function fixture(name: string, run: (f: any) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "fondue-push-integration-"));
  try {
    const recipe = full.recipes.find(
      (r) => r.id === `components/${name}/controls-001`,
    )!;
    const bundle = { ...full, recipes: [recipe] };
    const baselineRoot = join(root, "baseline"),
      sourceRoot = join(root, "source");
    const paths = [
      ...recipe.source,
      "packages/tokens/src/styleDictionary/buildStyleDictionary.ts",
      "packages/tokens/dist/manifest.json",
    ];
    for (const p of paths)
      for (const target of [baselineRoot, sourceRoot]) {
        await mkdir(dirname(join(target, p)), { recursive: true });
        await writeFile(join(target, p), await readFile(join(releaseRoot, p)));
      }
    const variant = recipe.variants[0];
    const main = node("main", "COMPONENT", {
      width: 100,
      height: 32,
      cornerRadius: 4,
      children: [],
    });
    const owner = node("set", "COMPONENT_SET", { children: [main] });
    main.parent = owner;
    write(main, "identity", variant.root.id);
    write(main, "variant", variant.id);
    write(
      owner,
      "mapping",
      JSON.stringify({ id: `recipe:${recipe.id}`, release: bundle.release }),
    );
    write(
      owner,
      "applied",
      JSON.stringify({
        nodeId: owner.id,
        definition: JSON.stringify(recipe),
        snapshot: await snapshot(owner),
      }),
    );
    const instance = node("instance", "INSTANCE", {
      cornerRadius: 12,
      width: 100,
      height: 32,
      children: [],
      getMainComponentAsync: async () => main,
      overrides: [{ id: "instance", overriddenFields: ["cornerRadius"] }],
    });
    const variables = new Map();
    const api = {
      currentPage: { selection: [instance] },
      variables: {
        getVariableByIdAsync: async (id: string) => variables.get(id),
        getVariableCollectionByIdAsync: async () => ({
          modes: [{ modeId: "value", name: "Value" }],
        }),
      },
    };
    await run({
      bundle,
      recipe,
      variant,
      main,
      owner,
      instance,
      variables,
      api,
      sourceRoot,
      baselineRoot,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
for (const name of ["Button", "Badge", "TextInput"]) {
  test(`${name}: selected instance literal radius generates exact reviewed SCSS and durable token source`, async () =>
    fixture(name, async (f) => {
      const baseline = read(f.owner, "applied");
      const report = await inspectSelection(f.api, f.bundle);
      assert.deepEqual(report.issues, []);
      assert.equal(report.changes.length, 1);
      assert.equal(report.changes[0].property, "cornerRadius");
      assert.equal(report.tokens[0].requiresName, true);
      const blocked = await generatePushPatch({
        proposal: report,
        sourceRoot: f.sourceRoot,
        baselineRoot: f.baselineRoot,
        bundle: f.bundle,
      });
      const sourcePath = f.recipe.source.find(
        (p: string) => p.endsWith(".module.scss") && !p.includes("utilities"),
      );
      const original = await readFile(join(f.sourceRoot, sourcePath), "utf8");
      const declaration = declarations(original).find(
        (d) =>
          d.property === "border-radius" &&
          (name === "Badge"
            ? d.value === "9999px"
            : d.value === "var(--border-radius-medium)"),
      )!;
      assert.ok(declaration);
      const change = report.changes[0];
      const mapping = {
        recipeId: change.recipeId,
        variantId: change.variantId,
        layerId: change.layerId,
        figmaProperty: change.property,
        path: sourcePath,
        selector: declaration.selector,
        property: declaration.property,
        start: declaration.start,
        expectedValue: declaration.value,
        allowLiteralPromotion: name === "Badge",
      };
      const cssName = `border-radius-${name.toLowerCase()}-proposed`;
      const proposal = {
        ...report,
        tokenNames: { [report.tokens[0].id]: cssName },
      };
      const result = await generatePushPatch({
        proposal,
        sourceRoot: f.sourceRoot,
        baselineRoot: f.baselineRoot,
        bundle: f.bundle,
        mappings: [mapping],
      });
      assert.deepEqual(result.issues, []);
      assert.equal(
        createHash("sha256").update(original).digest("hex"),
        f.bundle.provenance.inputs[sourcePath],
      );
      const scss = result.files.find((file) => file.path === sourcePath)!;
      assert.ok(scss.after.includes(`border-radius: var(--${cssName})`));
      const tokens = JSON.parse(
        result.files.find(
          (file) => file.path === "packages/tokens/repository-tokens.json",
        )!.after,
      );
      assert.equal(
        tokens.default["border-radius"][`${name.toLowerCase()}-proposed`].value,
        12,
      );
      assert.ok(
        result.files.some(
          (file) =>
            file.path.endsWith("buildStyleDictionary.ts") &&
            file.after.includes("repository-tokens.json"),
        ),
      );
      if (name === "TextInput") {
        assert.ok(
          scss.after.includes(
            `calc(var(--${cssName}) - var(--border-width-default))`,
          ),
        );
        assert.ok(scss.after.includes("border-start-start-radius: 0px"));
        assert.ok(scss.after.includes("@include focusStyle.focus-outline"));
      }
      assert.equal(
        await readFile(join(f.sourceRoot, sourcePath), "utf8"),
        original,
      );
      assert.equal(read(f.owner, "applied"), baseline);
      assert.ok(blocked.issues.length > 0);
      assert.deepEqual(blocked.files, []);
    }));
}
test("Button: selected instance existing-token binding generates named CSS reference", async () =>
  fixture("Button", async (f) => {
    const token = f.bundle.tokens.find(
      (t: any) => t.id === "border-radius-large",
    );
    assert.ok(token);
    const variable = node("native-large", "", {
      name: token.name,
      resolvedType: token.type,
      variableCollectionId: "collection",
      valuesByMode: { value: 8 },
    });
    write(
      variable,
      "applied",
      JSON.stringify({
        nodeId: variable.id,
        definition: JSON.stringify(token),
        snapshot: await snapshot(variable),
      }),
    );
    f.variables.set(variable.id, variable);
    f.instance.boundVariables = {
      cornerRadius: { type: "VARIABLE_ALIAS", id: variable.id },
    };
    f.instance.overrides = [
      { id: f.instance.id, overriddenFields: ["boundVariables"] },
    ];
    const report = await inspectSelection(f.api, f.bundle);
    assert.deepEqual(report.issues, []);
    assert.equal(report.changes.length, 1);
    assert.equal(report.changes[0].property, "boundVariables.cornerRadius");
    assert.deepEqual(report.changes[0].tokenIds, ["border-radius-large"]);
    const sourcePath = f.recipe.source.find((p: string) =>
      p.endsWith("button.module.scss"),
    );
    const original = await readFile(join(f.sourceRoot, sourcePath), "utf8");
    const d = declarations(original).find(
      (d) =>
        d.value === "var(--border-radius-medium)" &&
        d.property === "border-radius",
    )!;
    const c = report.changes[0];
    const result = await generatePushPatch({
      proposal: report,
      sourceRoot: f.sourceRoot,
      baselineRoot: f.baselineRoot,
      bundle: f.bundle,
      mappings: [
        {
          recipeId: c.recipeId,
          variantId: c.variantId,
          layerId: c.layerId,
          figmaProperty: c.property,
          path: sourcePath,
          selector: d.selector,
          property: d.property,
          start: d.start,
          expectedValue: d.value,
        },
      ],
    });
    assert.deepEqual(result.issues, []);
    assert.equal(result.files.length, 1);
    assert.ok(result.files[0].after.includes("var(--border-radius-large)"));
  }));
test("source baseline hash mismatch blocks the scanned proposal", async () =>
  fixture("TextInput", async (f) => {
    const report = await inspectSelection(f.api, f.bundle),
      c = report.changes[0];
    const sourcePath = f.recipe.source.find((p: string) =>
      p.endsWith("text.module.scss"),
    );
    const original = await readFile(join(f.sourceRoot, sourcePath), "utf8");
    const d = declarations(original).find(
      (d) =>
        d.property === "border-radius" &&
        d.value === "var(--border-radius-medium)",
    )!;
    const bundle = {
      ...f.bundle,
      provenance: {
        ...f.bundle.provenance,
        inputs: { ...f.bundle.provenance.inputs, [sourcePath]: "0".repeat(64) },
      },
    };
    const result = await generatePushPatch({
      proposal: {
        ...report,
        tokenNames: { [report.tokens[0].id]: "border-radius-custom" },
      },
      sourceRoot: f.sourceRoot,
      baselineRoot: f.baselineRoot,
      bundle,
      mappings: [
        {
          recipeId: c.recipeId,
          layerId: c.layerId,
          figmaProperty: c.property,
          path: sourcePath,
          selector: d.selector,
          property: d.property,
          expectedValue: d.value,
        },
      ],
    });
    assert.ok(
      result.issues.some(
        (i) => i.code === "source-conflict" && i.message.includes("hash"),
      ),
    );
    assert.deepEqual(result.files, []);
  }));
