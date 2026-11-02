import { test } from "node:test";
import assert from "node:assert/strict";
import { organizeComponentNames } from "../src/organization";
import { read, write } from "../src/metadata";
import { canonical, decide } from "../src/plan";
import type { Bundle } from "../src/schema";

function setup() {
  const data = new Map<string, string>();
  const node = {
    id: "set",
    type: "COMPONENT_SET",
    name: "Accordion/pill",
    description: "Locally improved guidance",
    children: [{ id: "variant" }],
    getSharedPluginData: (ns: string, key: string) => data.get(ns + key) ?? "",
    setSharedPluginData: (ns: string, key: string, value: string) => {
      data.set(ns + key, value);
    },
  };
  const section = { id: "section", type: "SECTION", name: "Accordion" };
  const api = {
    getNodeByIdAsync: async (id: string) =>
      id === "set" ? node : id === "section" ? section : null,
  } as any;
  const recipe = {
    id: "components/Accordion.pill",
    name: "Accordion/pill",
    package: "components",
    assetName: "Content/Accordion/pill",
    libraryCategory: "Content",
  };
  const definition = {
    id: recipe.id,
    name: recipe.name,
    rendererRevision: "previous",
    variants: [{ id: "default" }],
  };
  const baseline = {
    nodeId: node.id,
    definition: canonical(definition),
    snapshot: canonical({ name: node.name, description: "Original guidance" }),
  };
  write(node, "applied", JSON.stringify(baseline));
  const bundle = { recipes: [recipe] } as unknown as Bundle;
  const index = {
    assets: { ["recipe:" + recipe.id]: { id: node.id, kind: "recipe" } },
    sections: { "components/Accordion": section.id },
  };
  return { node, api, bundle, index, recipe, section };
}

test("category-only organization preserves local edits and keeps them conflicted", async () => {
  const f = setup();
  const children = f.node.children;
  const result = await organizeComponentNames(f.api, f.bundle, f.index);
  assert.equal(result.renamed, 1);
  assert.deepEqual(result.conflicts, []);
  assert.equal(f.node.name, "Content/Accordion/pill");
  assert.equal(f.node.description, "Locally improved guidance");
  assert.equal(f.node.children, children);
  assert.equal(f.section.name, "Content / Accordion");
  const saved = JSON.parse(read(f.node, "applied"));
  assert.equal(JSON.parse(saved.snapshot).description, "Original guidance");
  assert.equal(JSON.parse(saved.definition).rendererRevision, "previous");
  assert.equal(
    decide(
      { id: f.recipe.id, kind: "recipe", definition: saved.definition },
      saved,
      canonical({ name: f.node.name, description: f.node.description }),
    ).action,
    "conflict",
  );
  const repeat = await organizeComponentNames(f.api, f.bundle, f.index);
  assert.equal(repeat.renamed, 0);
  assert.equal(repeat.alreadyOrganized, 1);
  assert.deepEqual(repeat.mutatedNodeIds, []);
});

test("local component renames stop organization without modifying any baselines", async () => {
  const f = setup();
  const baseline = read(f.node, "applied");
  f.node.name = "My custom accordion";
  const result = await organizeComponentNames(f.api, f.bundle, f.index);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.renamed, 0);
  assert.equal(read(f.node, "applied"), baseline);
  assert.equal(f.section.name, "Accordion");
});

test("missing managed components prevent partial category application", async () => {
  const f = setup();
  f.bundle.recipes.push({ ...f.bundle.recipes[0], id: "components/missing" });
  const result = await organizeComponentNames(f.api, f.bundle, f.index);
  assert.equal(result.conflicts.length, 1);
  assert.equal(f.node.name, "Accordion/pill");
  assert.equal(f.section.name, "Accordion");
});
