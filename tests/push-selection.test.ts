import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectSelection } from "../src/push-selection";
import { snapshot } from "../src/snapshot";
import { write, read } from "../src/metadata";
import type { Bundle } from "../src/schema";
function node(id: string, type: string, properties: any = {}) {
  const data = new Map<string, string>();
  return {
    id,
    type,
    ...properties,
    getSharedPluginData: (ns: string, k: string) =>
      data.get(ns + ":" + k) ?? "",
    setSharedPluginData: (ns: string, k: string, v: string) =>
      data.set(ns + ":" + k, v),
  } as any;
}
async function fixture(name = "Badge") {
  const bundle = {
    schemaVersion: 1,
    release: "13",
    fingerprint: "bundle",
    provenance: { commit: "abc" },
    recipes: [
      {
        id: name,
        name,
        package: "@frontify/fondue/components",
        source: [`packages/components/${name}.tsx`],
        variants: [
          {
            id: "default",
            props: {},
            root: { id: "root", kind: "frame", name },
          },
        ],
        limitations: [],
        status: "supported",
      },
    ],
    tokens: [],
    styles: [],
    icons: [],
    gaps: [],
    inventory: [],
  } as Bundle;
  const child = node("child", "RECTANGLE", {
    width: 24,
    height: 24,
    paddingLeft: 4,
    children: [],
  });
  const main = node("main", "COMPONENT", {
    width: 100,
    height: 32,
    paddingLeft: 8,
    children: [child],
  });
  const set = node("set", "COMPONENT_SET", { children: [main] });
  main.parent = set;
  child.parent = main;
  write(main, "identity", "root");
  write(main, "variant", "default");
  write(child, "identity", "icon");
  write(set, "mapping", JSON.stringify({ id: `recipe:${name}` }));
  write(
    set,
    "applied",
    JSON.stringify({
      nodeId: set.id,
      definition: JSON.stringify(bundle.recipes[0]),
      snapshot: await snapshot(set),
    }),
  );
  const variables = new Map<string, any>();
  const api: any = {
    currentPage: { selection: [main] },
    variables: {
      getVariableByIdAsync: async (id: string) => variables.get(id),
      getVariableCollectionByIdAsync: async () => ({
        modes: [{ modeId: "mode", name: "Value" }],
      }),
    },
  };
  return { bundle, api, child, main, set, variables };
}
test("selection works for every recipe identity, preserves baselines, and excludes siblings", async () => {
  for (const name of ["Badge", "Button", "TextInput", "ComplexChart"]) {
    const f = await fixture(name),
      before = read(f.set, "applied");
    f.api.currentPage.selection = [f.child];
    f.child.paddingLeft = 12;
    f.main.paddingLeft = 20;
    const report = await inspectSelection(f.api, f.bundle);
    assert.equal(report.issues.length, 0);
    assert.equal(report.components[0].recipeId, name);
    assert.equal(report.changes.length, 1);
    assert.equal(report.changes[0].nodeId, "child");
    assert.equal(report.changes[0].before, 4);
    assert.equal(report.changes[0].after, 12);
    assert.equal(report.tokens[0].requiresName, true);
    assert.equal(read(f.set, "applied"), before);
  }
});
test("overlapping selections deduplicate changes", async () => {
  const f = await fixture();
  f.api.currentPage.selection = [f.main, f.child];
  f.child.paddingLeft = 16;
  const r = await inspectSelection(f.api, f.bundle);
  assert.equal(r.changes.length, 1);
});
test("instance only exports direct overrides and resolves its component", async () => {
  const f = await fixture();
  const instance = node("instance", "INSTANCE", {
    width: 150,
    height: 32,
    paddingLeft: 16,
    children: [],
    getMainComponentAsync: async () => f.main,
    overrides: [{ id: "instance", overriddenFields: ["paddingLeft"] }],
  });
  f.api.currentPage.selection = [instance];
  const r = await inspectSelection(f.api, f.bundle);
  assert.equal(r.issues.length, 0);
  assert.equal(r.changes.length, 1);
  assert.equal(r.changes[0].property, "paddingLeft");
  assert.equal(r.changes[0].before, 8);
  assert.equal(r.changes[0].after, 16);
  assert.equal(r.components[0].isInstance, true);
  assert.match(r.warnings[0], /shared component/);
});
test("changed referenced shared token is included; unrelated token is never read", async () => {
  const f = await fixture();
  const variable = node("v", "", {
    name: "spacing/4",
    resolvedType: "FLOAT",
    variableCollectionId: "collection",
    valuesByMode: { mode: 4 },
  });
  write(
    variable,
    "applied",
    JSON.stringify({
      nodeId: "v",
      definition: JSON.stringify({
        id: "spacing-4",
        name: "spacing/4",
        type: "FLOAT",
        values: { Value: 4 },
        css: "--spacing-4",
      }),
      snapshot: await snapshot(variable),
    }),
  );
  f.variables.set("v", variable);
  f.child.boundVariables = { paddingLeft: { type: "VARIABLE_ALIAS", id: "v" } };
  write(
    f.set,
    "applied",
    JSON.stringify({
      nodeId: f.set.id,
      definition: JSON.stringify(f.bundle.recipes[0]),
      snapshot: await snapshot(f.set),
    }),
  );
  variable.valuesByMode.mode = 6;
  f.api.currentPage.selection = [f.child];
  const r = await inspectSelection(f.api, f.bundle);
  assert.equal(r.issues.length, 0);
  assert.equal(r.changes.length, 1);
  assert.equal(r.changes[0].scope, "shared-token");
  assert.equal(r.tokens[0].id, "spacing-4");
  assert.deepEqual(r.tokens[0].values, { Value: 6 });
});
test("new variable alias dependencies are canonicalized and included", async () => {
  const f = await fixture();
  f.variables.set(
    "primitive",
    node("primitive", "", {
      name: "spacing/new",
      resolvedType: "FLOAT",
      variableCollectionId: "c",
      valuesByMode: { mode: 11 },
    }),
  );
  f.variables.set(
    "semantic",
    node("semantic", "", {
      name: "spacing/control",
      resolvedType: "FLOAT",
      variableCollectionId: "c",
      valuesByMode: { mode: { type: "VARIABLE_ALIAS", id: "primitive" } },
    }),
  );
  f.child.boundVariables = {
    paddingLeft: { type: "VARIABLE_ALIAS", id: "semantic" },
  };
  f.api.currentPage.selection = [f.child];
  const r = await inspectSelection(f.api, f.bundle);
  assert.equal(r.issues.length, 0);
  assert.equal(r.tokens.length, 2);
  assert.deepEqual(r.tokens.find((t) => t.variableId === "semantic")?.values, {
    Value: { alias: "new:primitive" },
  });
  assert.deepEqual(
    r.changes.find((c) => c.property === "boundVariables.paddingLeft")
      ?.tokenIds,
    ["new:semantic"],
  );
});
test("missing selection, unmanaged objects, unsupported edits and alias cycles block", async () => {
  const f = await fixture();
  f.api.currentPage.selection = [];
  assert.equal(
    (await inspectSelection(f.api, f.bundle)).issues[0].code,
    "empty-selection",
  );
  f.api.currentPage.selection = [node("free", "FRAME")];
  assert.equal(
    (await inspectSelection(f.api, f.bundle)).issues[0].code,
    "unmanaged-selection",
  );
  f.api.currentPage.selection = [f.main];
  f.child.rotation = 45;
  assert.ok(
    (await inspectSelection(f.api, f.bundle)).issues.some(
      (i) => i.code === "unsupported-property",
    ),
  );
  f.variables.set(
    "cycle",
    node("cycle", "", {
      name: "cycle",
      resolvedType: "FLOAT",
      variableCollectionId: "c",
      valuesByMode: { mode: { type: "VARIABLE_ALIAS", id: "cycle" } },
    }),
  );
  f.child.boundVariables = {
    paddingLeft: { type: "VARIABLE_ALIAS", id: "cycle" },
  };
  assert.ok(
    (await inspectSelection(f.api, f.bundle)).issues.some(
      (i) => i.code === "token-alias-cycle",
    ),
  );
});

test("removed selected child and mismatched imported release require review", async () => {
  const f = await fixture();
  f.main.children = [];
  const r = await inspectSelection(f.api, f.bundle);
  assert.ok(r.issues.some((i) => i.code === "structural-change"));
  write(
    f.set,
    "mapping",
    JSON.stringify({ id: "recipe:Badge", release: "older" }),
  );
  assert.equal(
    (await inspectSelection(f.api, f.bundle)).issues[0].code,
    "baseline-release",
  );
});
test("rebinding does not propose edits to the old shared token", async () => {
  const f = await fixture();
  const old = node("old", "", {
    name: "old",
    resolvedType: "FLOAT",
    variableCollectionId: "c",
    valuesByMode: { mode: 4 },
  });
  write(
    old,
    "applied",
    JSON.stringify({
      nodeId: "old",
      definition: JSON.stringify({
        id: "old-token",
        name: "old",
        type: "FLOAT",
        values: { Value: 4 },
      }),
      snapshot: await snapshot(old),
    }),
  );
  f.variables.set("old", old);
  const next = node("next", "", {
    name: "next",
    resolvedType: "FLOAT",
    variableCollectionId: "c",
    valuesByMode: { mode: 9 },
  });
  f.variables.set("next", next);
  f.child.boundVariables = {
    paddingLeft: { type: "VARIABLE_ALIAS", id: "old" },
  };
  write(
    f.set,
    "applied",
    JSON.stringify({
      nodeId: f.set.id,
      definition: JSON.stringify(f.bundle.recipes[0]),
      snapshot: await snapshot(f.set),
    }),
  );
  old.valuesByMode.mode = 12;
  f.child.boundVariables = {
    paddingLeft: { type: "VARIABLE_ALIAS", id: "next" },
  };
  f.api.currentPage.selection = [f.child];
  const r = await inspectSelection(f.api, f.bundle);
  assert.equal(r.issues.length, 0);
  assert.equal(r.changes.length, 1);
  assert.equal(r.changes[0].property, "boundVariables.paddingLeft");
  assert.deepEqual(r.changes[0].before, {
    type: "VARIABLE_ALIAS",
    id: "old-token",
  });
  assert.deepEqual(r.changes[0].tokenIds, ["new:next"]);
  assert.equal(r.tokens.length, 1);
});

test("uniform radius exports one token proposal rather than four corner duplicates", async () => {
  const f = await fixture();
  f.child.cornerRadius = 4;
  write(
    f.set,
    "applied",
    JSON.stringify({
      nodeId: f.set.id,
      definition: JSON.stringify(f.bundle.recipes[0]),
      snapshot: await snapshot(f.set),
    }),
  );
  f.child.cornerRadius = 12;
  f.api.currentPage.selection = [f.child];
  const r = await inspectSelection(f.api, f.bundle);
  assert.equal(r.issues.length, 0);
  assert.equal(r.changes.length, 1);
  assert.equal(r.changes[0].property, "cornerRadius");
  assert.equal(r.changes[0].after, 12);
  assert.equal(r.tokens.length, 1);
});

test("unchanged nested instance descendants are not scanned; edited nested instance asks for direct selection", async () => {
  const f = await fixture();
  const iconMain = node("icon-main", "COMPONENT", { children: [] });
  const vector = node("vector", "VECTOR", { children: [] });
  const nested = node("nested", "INSTANCE", {
    children: [vector],
    paddingLeft: 4,
    getMainComponentAsync: async () => iconMain,
    overrides: [],
  });
  nested.parent = f.main;
  vector.parent = nested;
  write(nested, "identity", "nested-icon");
  f.main.children.push(nested);
  write(
    f.set,
    "applied",
    JSON.stringify({
      nodeId: f.set.id,
      definition: JSON.stringify(f.bundle.recipes[0]),
      snapshot: await snapshot(f.set),
    }),
  );
  const unchanged = await inspectSelection(f.api, f.bundle);
  assert.deepEqual(unchanged.issues, []);
  assert.deepEqual(unchanged.changes, []);
  nested.paddingLeft = 9;
  nested.overrides = [{ id: nested.id, overriddenFields: ["paddingLeft"] }];
  const edited = await inspectSelection(f.api, f.bundle);
  assert.ok(edited.issues.some((i) => i.code === "nested-instance-change"));
});

test("multiple selected instances with conflicting overrides block rather than drop the second edit", async () => {
  const f = await fixture();
  const makeInstance = (id: string, paddingLeft: number) =>
    node(id, "INSTANCE", {
      children: [],
      paddingLeft,
      getMainComponentAsync: async () => f.main,
      overrides: [{ id, overriddenFields: ["paddingLeft"] }],
    });
  f.api.currentPage.selection = [
    makeInstance("one", 12),
    makeInstance("two", 20),
  ];
  const r = await inspectSelection(f.api, f.bundle);
  assert.equal(r.changes.length, 1);
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].code, "conflicting-selection");
  assert.equal(r.issues[0].nodeId, "two");
  assert.equal(r.issues[0].blocking, true);
});
test("identical overrides across selected instances deduplicate without blocking", async () => {
  const f = await fixture();
  const makeInstance = (id: string) =>
    node(id, "INSTANCE", {
      children: [],
      paddingLeft: 12,
      getMainComponentAsync: async () => f.main,
      overrides: [{ id, overriddenFields: ["paddingLeft"] }],
    });
  f.api.currentPage.selection = [makeInstance("one"), makeInstance("two")];
  const r = await inspectSelection(f.api, f.bundle);
  assert.equal(r.changes.length, 1);
  assert.equal(r.tokens.length, 1);
  assert.deepEqual(r.issues, []);
});
test("unchanged instances and inherited dimensions are not proposed as edits", async () => {
  const f = await fixture();
  const inherited = node("inherited", "INSTANCE", {
    children: [],
    width: 300,
    height: 200,
    paddingLeft: 20,
    getMainComponentAsync: async () => f.main,
    overrides: [],
  });
  const explicitDefault = node("default", "INSTANCE", {
    children: [],
    width: 100,
    height: 32,
    getMainComponentAsync: async () => f.main,
    overrides: [{ id: "default", overriddenFields: ["width", "height"] }],
  });
  f.api.currentPage.selection = [inherited, explicitDefault];
  const r = await inspectSelection(f.api, f.bundle);
  assert.deepEqual(r.issues, []);
  assert.deepEqual(r.changes, []);
  assert.deepEqual(r.tokens, []);
});

test("instance label and exposed property choices remain local while a chosen variant radius is proposed", async () => {
  const f = await fixture("Button");
  const variant = "variant=primary;size=large";
  write(f.main, "variant", variant);
  f.child.type = "TEXT";
  f.child.characters = "Default label";
  f.child.componentPropertyReferences = {
    characters: "Label#1",
    visible: "ShowLabel#2",
  };
  f.child.visible = true;
  f.bundle.recipes[0].variants[0].id = variant;
  f.bundle.recipes[0].variants[0].props = { variant: "primary", size: "large" };
  write(
    f.set,
    "applied",
    JSON.stringify({
      nodeId: f.set.id,
      definition: JSON.stringify(f.bundle.recipes[0]),
      snapshot: await snapshot(f.set),
    }),
  );
  const label = node("custom-label", "TEXT", {
    width: 24,
    height: 24,
    paddingLeft: 4,
    characters: "Save draft",
    visible: false,
    componentPropertyReferences: {
      characters: "Label#1",
      visible: "ShowLabel#2",
    },
    children: [],
  });
  write(label, "identity", "icon");
  const instance = node("chosen-instance", "INSTANCE", {
    width: 100,
    height: 32,
    cornerRadius: 12,
    children: [label],
    componentProperties: {
      "Label#1": { type: "TEXT", value: "Save draft" },
      "ShowLabel#2": { type: "BOOLEAN", value: false },
      variant: { type: "VARIANT", value: "primary" },
      size: { type: "VARIANT", value: "large" },
    },
    getMainComponentAsync: async () => f.main,
    overrides: [
      {
        id: "chosen-instance",
        overriddenFields: ["componentProperties", "cornerRadius"],
      },
      {
        id: label.id,
        overriddenFields: [
          "characters",
          "componentPropertyReferences",
          "visible",
        ],
      },
    ],
  });
  label.parent = instance;
  f.api.currentPage.selection = [instance];
  const r = await inspectSelection(f.api, f.bundle);
  assert.deepEqual(r.issues, []);
  assert.equal(r.changes.length, 1);
  assert.equal(r.changes[0].property, "cornerRadius");
  assert.equal(r.changes[0].variantId, variant);
  assert.equal(r.changes[0].after, 12);
  assert.equal(r.tokens.length, 1);
});
test("main component content and unexposed instance behavior edits still require mappings", async () => {
  const f = await fixture("Button");
  f.child.type = "TEXT";
  f.child.characters = "Changed default label";
  const mainReport = await inspectSelection(f.api, f.bundle);
  assert.ok(
    mainReport.issues.some(
      (i) =>
        i.code === "unsupported-property" && i.message.includes("characters"),
    ),
  );
  const instance = node("changed-behavior", "INSTANCE", {
    children: [],
    visible: false,
    getMainComponentAsync: async () => f.main,
    overrides: [{ id: "changed-behavior", overriddenFields: ["visible"] }],
  });
  f.api.currentPage.selection = [instance];
  const r = await inspectSelection(f.api, f.bundle);
  assert.ok(
    r.issues.some(
      (i) => i.code === "unsupported-property" && i.message.includes("visible"),
    ),
  );
});

test("nested instance content overrides do not block an outer component visual edit", async () => {
  const f = await fixture("Button");
  const iconMain = node("icon-main", "COMPONENT", { children: [] });
  const text = node("nested-label", "TEXT", {
    characters: "Default",
    children: [],
  });
  write(text, "identity", "text");
  const nested = node("nested", "INSTANCE", {
    children: [text],
    getMainComponentAsync: async () => iconMain,
    overrides: [],
  });
  nested.parent = f.main;
  text.parent = nested;
  write(nested, "identity", "nested-icon");
  f.main.children.push(nested);
  write(
    f.set,
    "applied",
    JSON.stringify({
      nodeId: f.set.id,
      definition: JSON.stringify(f.bundle.recipes[0]),
      snapshot: await snapshot(f.set),
    }),
  );
  text.characters = "Product copy";
  nested.overrides = [{ id: text.id, overriddenFields: ["characters"] }];
  const mainReport = await inspectSelection(f.api, f.bundle);
  assert.ok(mainReport.issues.some((i) => i.code === "nested-instance-change"));
  const outer = node("outer-instance", "INSTANCE", {
    children: [f.child, nested],
    paddingLeft: 12,
    getMainComponentAsync: async () => f.main,
    overrides: [{ id: "outer-instance", overriddenFields: ["paddingLeft"] }],
  });
  f.child.parent = outer;
  nested.parent = outer;
  f.api.currentPage.selection = [outer];
  const r = await inspectSelection(f.api, f.bundle);
  assert.deepEqual(r.issues, []);
  assert.equal(r.changes.length, 1);
  assert.equal(r.changes[0].property, "paddingLeft");
});
