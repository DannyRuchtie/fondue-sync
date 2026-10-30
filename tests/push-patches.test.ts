import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  declarations,
  buildReverseCoverage,
  candidatesForChange,
} from "../recipes/reverse-mappings.mjs";
import { generatePushPatch } from "../scripts/push-patches.mjs";
const sourcePath =
  "packages/components/src/components/Button/styles/button.module.scss";
const source =
  ".root {\n border-radius: var(--border-radius-medium);\n &:focus-visible { outline: 2px solid blue; }\n}\n";
const bundle = {
  fingerprint: "bundle1",
  provenance: { commit: "abc" },
  tokens: [{ id: "border-radius-large", css: "var(--border-radius-large)" }],
  recipes: [{ id: "components/Button", name: "Button", source: [sourcePath] }],
};
const change = {
  id: "c1",
  recipeId: "components/Button",
  layerId: "button",
  property: "cornerRadius",
  before: 4,
  after: "border-radius-large",
  scope: "component",
};
const proposal = {
  fingerprint: "bundle1",
  sourceCommit: "abc",
  changes: [change],
  tokens: [],
};
const mapping = {
  recipeId: "components/Button",
  layerId: "button",
  figmaProperty: "cornerRadius",
  path: sourcePath,
  selector: ".root",
  property: "border-radius",
  expectedValue: "var(--border-radius-medium)",
};
async function fixture(
  run: (sourceRoot: string, baselineRoot: string) => Promise<void>,
) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "fondue-push-"));
  try {
    const roots = [path.join(dir, "source"), path.join(dir, "baseline")];
    for (const root of roots) {
      await mkdir(path.dirname(path.join(root, sourcePath)), {
        recursive: true,
      });
      await writeFile(path.join(root, sourcePath), source);
    }
    await run(roots[0], roots[1]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
test("SCSS lexer retains exact values and selectors without touching comments or quoted delimiters", () => {
  const css =
    '/* color: red; */\n.root { border-radius: calc(var(--radius) - 1px); content: "};"; &:hover { color: red; } }';
  const ds = declarations(css);
  assert.equal(ds.length, 3);
  assert.equal(ds[0].selector, ".root");
  assert.equal(ds[2].selector, ".root > &:hover");
  for (const d of ds) assert.equal(css.slice(d.start, d.end), d.value);
});
test("every recipe has honest mapping coverage including code-only components", async () => {
  const full = {
    ...bundle,
    recipes: [
      ...bundle.recipes,
      {
        id: "rte/Toolbar",
        name: "Toolbar",
        source: ["packages/rte/src/Toolbar.tsx"],
      },
    ],
  };
  const coverage = await buildReverseCoverage(full, async () => source, [
    mapping,
  ]);
  assert.equal(coverage.total, 2);
  assert.equal(coverage.mapped, 1);
  assert.equal(coverage.entries[1].status, "needs-review");
});
test("mapped patch changes only intended declaration and preserves focus behavior", async () =>
  fixture(async (sourceRoot, baselineRoot) => {
    const result = await generatePushPatch({
      proposal,
      sourceRoot,
      baselineRoot,
      bundle,
      mappings: [mapping],
    });
    assert.deepEqual(result.issues, []);
    assert.equal(result.files.length, 1);
    assert.equal(
      result.files[0].after,
      source.replace(
        "var(--border-radius-medium)",
        "var(--border-radius-large)",
      ),
    );
    assert.equal(
      await readFile(path.join(sourceRoot, sourcePath), "utf8"),
      source,
    );
  }));
test("missing mapping yields reviewable candidates, source choice is resolved server-side", async () =>
  fixture(async (sourceRoot, baselineRoot) => {
    const blocked = await generatePushPatch({
      proposal,
      sourceRoot,
      baselineRoot,
      bundle,
    });
    assert.equal(blocked.issues[0].code, "mapping-required");
    assert.deepEqual(blocked.files, []);
    const candidate = blocked.issues[0].candidates[0];
    const result = await generatePushPatch({
      proposal: { ...proposal, mappingChoices: { c1: candidate.id } },
      sourceRoot,
      baselineRoot,
      bundle,
    });
    assert.deepEqual(result.issues, []);
    assert.equal(result.files.length, 1);
  }));
test("upstream source drift blocks patch instead of replacing an unrelated value", async () =>
  fixture(async (sourceRoot, baselineRoot) => {
    await writeFile(
      path.join(sourceRoot, sourcePath),
      source.replace("--border-radius-medium", "--border-radius-small"),
    );
    const result = await generatePushPatch({
      proposal,
      sourceRoot,
      baselineRoot,
      bundle,
      mappings: [mapping],
    });
    assert.equal(result.issues[0].code, "source-conflict");
    assert.deepEqual(result.files, []);
  }));
test("ambiguous declarations, invalid paths and foreign source targets are blocked", async () =>
  fixture(async (sourceRoot, baselineRoot) => {
    const result = await generatePushPatch({
      proposal,
      sourceRoot,
      baselineRoot,
      bundle,
      mappings: [{ ...mapping, path: "packages/components/../../secrets" }],
    });
    assert.equal(result.issues[0].code, "invalid-mapping");
    assert.deepEqual(result.files, []);
    const other = await generatePushPatch({
      proposal: { ...proposal, fingerprint: "other" },
      sourceRoot,
      baselineRoot,
      bundle,
      mappings: [mapping],
    });
    assert.equal(other.issues[0].code, "baseline-mismatch");
    assert.deepEqual(other.files, []);
  }));
test("new token without durable source pipeline is blocked", async () =>
  fixture(async (sourceRoot, baselineRoot) => {
    const result = await generatePushPatch({
      proposal: {
        ...proposal,
        tokens: [
          {
            id: "custom-radius",
            name: "border-radius-custom",
            existing: false,
          },
        ],
      },
      sourceRoot,
      baselineRoot,
      bundle,
      mappings: [mapping],
      tokenAuthoring: null,
    });
    assert.equal(result.issues[0].code, "token-authoring-unconfigured");
    assert.deepEqual(result.files, []);
  }));
test("calculated inner radius follows exact outer token while slot corners remain zero", async () =>
  fixture(async (sourceRoot, baselineRoot) => {
    const css =
      source +
      ".input {border-radius: calc(var(--border-radius-medium) - var(--border-width-default));} .slot {border-start-start-radius: 0px;}";
    for (const root of [sourceRoot, baselineRoot])
      await writeFile(path.join(root, sourcePath), css);
    const result = await generatePushPatch({
      proposal,
      sourceRoot,
      baselineRoot,
      bundle,
      mappings: [mapping],
    });
    assert.deepEqual(result.issues, []);
    assert.ok(
      result.files[0].after.includes(
        "calc(var(--border-radius-large) - var(--border-width-default))",
      ),
    );
    assert.ok(result.files[0].after.includes("border-start-start-radius: 0px"));
  }));
test("Tailwind mapping changes a static JSX class and preserves state modifiers and handlers", async () =>
  fixture(async (sourceRoot, baselineRoot) => {
    const p = "packages/rte/src/components/Toolbar.tsx";
    const tsx = `export const Toolbar = () => <button className="hover:!tw-rounded-md tw-px-2" onClick={handleClick}>Action</button>;`;
    for (const root of [sourceRoot, baselineRoot]) {
      await mkdir(path.dirname(path.join(root, p)), { recursive: true });
      await writeFile(path.join(root, p), tsx);
    }
    const b = {
      ...bundle,
      recipes: [{ id: "rte/Toolbar", name: "Toolbar", source: [p] }],
    };
    const c = { ...change, recipeId: "rte/Toolbar" };
    const prop = { ...proposal, changes: [c] };
    const blocked = await generatePushPatch({
      proposal: prop,
      sourceRoot,
      baselineRoot,
      bundle: b,
    });
    const candidate = blocked.issues[0].candidates[0];
    assert.equal(candidate.kind, "tailwind");
    const result = await generatePushPatch({
      proposal: { ...prop, mappingChoices: { c1: candidate.id } },
      sourceRoot,
      baselineRoot,
      bundle: b,
    });
    assert.deepEqual(result.issues, []);
    assert.ok(
      result.files[0].after.includes(
        "hover:!tw-[border-radius:var(--border-radius-large)]",
      ),
    );
    assert.ok(result.files[0].after.includes("onClick={handleClick}"));
  }));
test("released TextInput and Button token bindings produce actual focused source diffs; Badge accepts exact source review", async () => {
  const releaseRoot = path.resolve(" .cache/release".trim());
  const b = JSON.parse(
    await readFile(path.resolve("bundles/fondue-13.11.1.json"), "utf8"),
  );
  for (const name of ["TextInput", "Button", "Badge"]) {
    const recipe = b.recipes.find((r: any) =>
        r.id.startsWith(`components/${name}/`),
      ),
      variant = recipe.variants[0];
    const change = {
      id: "real",
      recipeId: recipe.id,
      variantId: variant.id,
      layerId: variant.root.id,
      property: "cornerRadius",
      before: variant.root.radius,
      after: 8,
      tokenIds: ["border-radius-large"],
      scope: "component",
    };
    const prop = {
      sourceCommit: b.provenance.commit,
      fingerprint: b.fingerprint,
      changes: [change],
      tokens: [],
    };
    let result = await generatePushPatch({
      sourceRoot: releaseRoot,
      bundle: b,
      proposal: prop,
    });
    if (name === "Badge" && result.issues.length) {
      const candidate = result.issues
        .find((i: any) => i.code === "mapping-required")
        .candidates.find(
          (c: any) =>
            c.path.endsWith("/styles/badge.module.scss") &&
            c.selector === ".root",
        );
      assert.ok(candidate);
      result = await generatePushPatch({
        sourceRoot: releaseRoot,
        bundle: b,
        proposal: { ...prop, mappingChoices: { real: candidate.id } },
      });
    }
    assert.deepEqual(result.issues, [], name);
    assert.equal(result.files.length, 1, name);
    assert.ok(result.files[0].after.includes("var(--border-radius-large)"));
    assert.ok(!result.files[0].path.endsWith(".tsx"));
  }
});
test("structural scanner blockers prevent partial visual PRs", async () =>
  fixture(async (sourceRoot, baselineRoot) => {
    const result = await generatePushPatch({
      proposal: {
        ...proposal,
        issues: [
          {
            code: "structure-changed",
            message: "A child was removed.",
            nodeId: "nested",
            blocking: true,
          },
        ],
      },
      sourceRoot,
      baselineRoot,
      bundle,
      mappings: [mapping],
    });
    assert.deepEqual(result.files, []);
    assert.ok(result.issues.some((i) => i.code === "structure-changed"));
  }));
test("padding shorthand changes only the selected side preserving other references", async () =>
  fixture(async (sourceRoot, baselineRoot) => {
    const css =
      ".root {padding: var(--spacing-medium) calc(var(--spacing-small) + 1px);}";
    for (const root of [sourceRoot, baselineRoot])
      await writeFile(path.join(root, sourcePath), css);
    const c = { ...change, property: "paddingTop", after: "spacing-large" };
    const prop = { ...proposal, changes: [c] };
    const b = {
      ...bundle,
      tokens: [
        { id: "spacing-large", type: "FLOAT", css: "var(--spacing-large)" },
      ],
    };
    const blocked = await generatePushPatch({
      proposal: prop,
      sourceRoot,
      baselineRoot,
      bundle: b,
    });
    const candidate = blocked.issues[0].candidates[0];
    const result = await generatePushPatch({
      proposal: { ...prop, mappingChoices: { c1: candidate.id } },
      sourceRoot,
      baselineRoot,
      bundle: b,
    });
    assert.deepEqual(result.issues, []);
    assert.equal(
      result.files[0].after,
      ".root {padding: var(--spacing-large) calc(var(--spacing-small) + 1px) var(--spacing-medium) calc(var(--spacing-small) + 1px);}",
    );
  }));
test("two selected padding sides compose without losing the first edit", async () =>
  fixture(async (sourceRoot, baselineRoot) => {
    const css = ".root {padding: var(--spacing-medium);}";
    for (const root of [sourceRoot, baselineRoot])
      await writeFile(path.join(root, sourcePath), css);
    const a = {
        ...change,
        id: "a",
        property: "paddingTop",
        after: "spacing-large",
      },
      b = {
        ...change,
        id: "b",
        property: "paddingRight",
        after: "spacing-large",
      };
    const prop = { ...proposal, changes: [a, b] },
      bun = {
        ...bundle,
        tokens: [
          { id: "spacing-large", type: "FLOAT", css: "var(--spacing-large)" },
        ],
      };
    const blocked = await generatePushPatch({
      proposal: prop,
      sourceRoot,
      baselineRoot,
      bundle: bun,
    });
    const choices = Object.fromEntries(
      blocked.issues
        .filter((i) => i.code === "mapping-required")
        .map((i) => [i.changeId, i.candidates[0].id]),
    );
    const result = await generatePushPatch({
      proposal: { ...prop, mappingChoices: choices },
      sourceRoot,
      baselineRoot,
      bundle: bun,
    });
    assert.deepEqual(result.issues, []);
    assert.equal(
      result.files[0].after,
      ".root {padding: var(--spacing-large) var(--spacing-large) var(--spacing-medium) var(--spacing-medium);}",
    );
  }));
test("three-way declaration merge preserves unrelated upstream edits", async () =>
  fixture(async (sourceRoot, baselineRoot) => {
    const upstream =
      "/* upstream comment */\n" +
      source.replace("outline: 2px solid blue", "outline: 3px solid green");
    await writeFile(path.join(sourceRoot, sourcePath), upstream);
    const result = await generatePushPatch({
      proposal,
      sourceRoot,
      baselineRoot,
      bundle,
      mappings: [mapping],
    });
    assert.deepEqual(result.issues, []);
    assert.equal(result.files[0].before, upstream);
    assert.equal(
      result.files[0].after,
      upstream.replace(
        "var(--border-radius-medium)",
        "var(--border-radius-large)",
      ),
    );
  }));
test("choosing changed current declaration cannot bless a baseline conflict", async () =>
  fixture(async (sourceRoot, baselineRoot) => {
    await writeFile(
      path.join(sourceRoot, sourcePath),
      source.replace(
        "var(--border-radius-medium)",
        "var(--border-radius-small)",
      ),
    );
    const blocked = await generatePushPatch({
      proposal,
      sourceRoot,
      baselineRoot,
      bundle,
    });
    const candidate = blocked.issues[0].candidates[0];
    const result = await generatePushPatch({
      proposal: { ...proposal, mappingChoices: { c1: candidate.id } },
      sourceRoot,
      baselineRoot,
      bundle,
    });
    assert.deepEqual(result.files, []);
    assert.ok(
      result.issues.some(
        (i) => i.code === "source-conflict" && i.message.includes("baseline"),
      ),
    );
  }));
test("calculated dependency drift blocks outer-radius update", async () =>
  fixture(async (sourceRoot, baselineRoot) => {
    const css =
      source +
      ".input {border-radius: calc(var(--border-radius-medium) - var(--border-width-default));}";
    await writeFile(path.join(baselineRoot, sourcePath), css);
    await writeFile(
      path.join(sourceRoot, sourcePath),
      css.replace("- var(--border-width-default)", "- 2px"),
    );
    const result = await generatePushPatch({
      proposal,
      sourceRoot,
      baselineRoot,
      bundle,
      mappings: [mapping],
    });
    assert.deepEqual(result.files, []);
    assert.ok(
      result.issues.some(
        (i) => i.code === "source-conflict" && i.message.includes("dependency"),
      ),
    );
  }));
test("Tailwind three-way merge preserves unrelated comments and utility edits", async () =>
  fixture(async (sourceRoot, baselineRoot) => {
    const p = "packages/rte/src/components/Toolbar.tsx",
      tsx =
        'export const Toolbar = () => <button className="tw-rounded-md tw-px-2">Action</button>;',
      upstream = "/* upstream */\n" + tsx.replace("tw-px-2", "tw-px-3");
    for (const [root, value] of [
      [sourceRoot, upstream],
      [baselineRoot, tsx],
    ]) {
      await mkdir(path.dirname(path.join(root, p)), { recursive: true });
      await writeFile(path.join(root, p), value);
    }
    const b = {
        ...bundle,
        recipes: [{ id: "rte/Toolbar", name: "Toolbar", source: [p] }],
      },
      c = { ...change, recipeId: "rte/Toolbar" },
      prop = { ...proposal, changes: [c] };
    const blocked = await generatePushPatch({
      proposal: prop,
      sourceRoot,
      baselineRoot,
      bundle: b,
    });
    const candidate = blocked.issues[0].candidates[0];
    const result = await generatePushPatch({
      proposal: { ...prop, mappingChoices: { c1: candidate.id } },
      sourceRoot,
      baselineRoot,
      bundle: b,
    });
    assert.deepEqual(result.issues, []);
    assert.equal(
      result.files[0].after,
      upstream.replace(
        "tw-rounded-md",
        "tw-[border-radius:var(--border-radius-large)]",
      ),
    );
  }));
test("same FLOAT type does not permit spacing token as a corner radius", async () =>
  fixture(async (sourceRoot, baselineRoot) => {
    const b = {
        ...bundle,
        tokens: [
          { id: "spacing-large", type: "FLOAT", css: "var(--spacing-large)" },
        ],
      },
      prop = { ...proposal, changes: [{ ...change, after: "spacing-large" }] };
    const result = await generatePushPatch({
      proposal: prop,
      sourceRoot,
      baselineRoot,
      bundle: b,
      mappings: [mapping],
    });
    assert.deepEqual(result.files, []);
    assert.ok(
      result.issues.some((i) => i.message.includes("semantic category")),
    );
  }));
test("generic source aliases inherit their target role and legitimate custom radius scopes remain valid", async () => {
  const { tokenCompatibleWithProperty } =
    await import("../recipes/reverse-mappings.mjs");
  const spacing = {
      id: "spacing-large",
      type: "FLOAT",
      css: "var(--spacing-large)",
    },
    generic = {
      id: "custom-distance",
      type: "FLOAT",
      values: { Value: { alias: "spacing-large" } },
    };
  assert.equal(
    tokenCompatibleWithProperty(generic, "cornerRadius", undefined, [
      spacing,
      generic,
    ]),
    false,
  );
  assert.equal(
    tokenCompatibleWithProperty(generic, "paddingLeft", undefined, [
      spacing,
      generic,
    ]),
    true,
  );
  assert.equal(
    tokenCompatibleWithProperty(
      { id: "custom-roundness", type: "FLOAT", scopes: ["CORNER_RADIUS"] },
      "cornerRadius",
    ),
    true,
  );
  assert.equal(
    tokenCompatibleWithProperty(
      { id: "legacy-custom-alias", type: "FLOAT" },
      "width",
    ),
    true,
  );
  assert.equal(
    tokenCompatibleWithProperty(
      { id: "border-radius-large", type: "FLOAT" },
      "fontSize",
    ),
    false,
  );
});
test("Tailwind discovery ignores comments, type literals, escaped classes and unknown dynamic transforms", async () => {
  const { tailwindDeclarations } =
    await import("../recipes/reverse-mappings.mjs");
  const tsx = `// className="tw-rounded-fake"
 const A=()=> <><button className={foo as 'tw-rounded-type'} /><button className={unknownTransform('tw-rounded-dynamic')} /><button className="tw-rounded-\\x6dd" /><button onClick={()=>'tw-rounded-handler'} className={merge(['tw-rounded-md', active && 'hover:tw-rounded-lg'])} /></>;`;
  const result = tailwindDeclarations(tsx);
  assert.deepEqual(
    result.map((d) => d.value),
    ["tw-rounded-md", "hover:tw-rounded-lg"],
  );
});
test("new SCSS property requires explicit source-selector review and preserves state rules", async () =>
  fixture(async (sourceRoot, baselineRoot) => {
    const css =
      ".root {\n    display: flex;\n    &:focus-visible { outline: 2px solid blue; }\n}\n";
    for (const root of [sourceRoot, baselineRoot])
      await writeFile(path.join(root, sourcePath), css);
    const blocked = await generatePushPatch({
      proposal,
      sourceRoot,
      baselineRoot,
      bundle,
    });
    assert.deepEqual(blocked.files, []);
    const issue = blocked.issues.find((i) => i.code === "mapping-required"),
      candidate = issue.candidates.find(
        (c: any) => c.kind === "insert" && c.selector === ".root",
      );
    assert.ok(candidate);
    assert.equal(candidate.expectedValue, "");
    const result = await generatePushPatch({
      proposal: { ...proposal, mappingChoices: { c1: candidate.id } },
      sourceRoot,
      baselineRoot,
      bundle,
    });
    assert.deepEqual(result.issues, []);
    assert.equal(
      result.files[0].after,
      ".root {\n    border-radius: var(--border-radius-large);\n    display: flex;\n    &:focus-visible { outline: 2px solid blue; }\n}\n",
    );
  }));
test("new-property insertion blocks current-property drift and changed selector structure", async () =>
  fixture(async (sourceRoot, baselineRoot) => {
    const css = ".root {\n    display: flex;\n}\n";
    for (const root of [sourceRoot, baselineRoot])
      await writeFile(path.join(root, sourcePath), css);
    const blocked = await generatePushPatch({
      proposal,
      sourceRoot,
      baselineRoot,
      bundle,
    });
    const candidate = blocked.issues[0].candidates.find(
      (c: any) => c.kind === "insert" && c.selector === ".root",
    );
    const insertMapping = { ...mapping, ...candidate };
    await writeFile(
      path.join(sourceRoot, sourcePath),
      css.replace("display: flex;", "display: flex;\n    border-radius: 2px;"),
    );
    const conflict = await generatePushPatch({
      proposal,
      sourceRoot,
      baselineRoot,
      bundle,
      mappings: [insertMapping],
    });
    assert.deepEqual(conflict.files, []);
    assert.ok(
      conflict.issues.some(
        (i) =>
          i.code === "source-conflict" && i.message.includes("already exists"),
      ),
    );
    await writeFile(
      path.join(sourceRoot, sourcePath),
      css.replace(
        "display: flex;",
        "display: flex;\n    &:hover {opacity: 0.5;}",
      ),
    );
    const structure = await generatePushPatch({
      proposal,
      sourceRoot,
      baselineRoot,
      bundle,
      mappings: [insertMapping],
    });
    assert.deepEqual(structure.files, []);
    assert.ok(
      structure.issues.some(
        (i) => i.code === "source-conflict" && i.message.includes("structure"),
      ),
    );
  }));
test("insertion candidates cannot recreate a property removed upstream", async () =>
  fixture(async (sourceRoot, baselineRoot) => {
    await writeFile(path.join(sourceRoot, sourcePath), ".root {display:flex;}");
    const blocked = await generatePushPatch({
      proposal,
      sourceRoot,
      baselineRoot,
      bundle,
    });
    const candidate = blocked.issues[0].candidates.find(
      (c: any) => c.kind === "insert" && c.selector === ".root",
    );
    assert.ok(candidate);
    const result = await generatePushPatch({
      proposal: { ...proposal, mappingChoices: { c1: candidate.id } },
      sourceRoot,
      baselineRoot,
      bundle,
    });
    assert.deepEqual(result.files, []);
    assert.ok(
      result.issues.some(
        (i) => i.code === "source-conflict" && i.message.includes("baseline"),
      ),
    );
  }));
