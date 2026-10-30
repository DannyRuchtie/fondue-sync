import { test } from "node:test";
import assert from "node:assert/strict";
import {
  recoveryDecision,
  partialRecipeProblems,
  type PartialRecipe,
} from "../src/recovery";
import type { Recipe } from "../src/schema";
import { canonical } from "../src/plan";
const target: Recipe = {
  id: "components/Test",
  name: "Test",
  package: "@frontify/fondue/components",
  source: ["Test.tsx"],
  status: "partial",
  limitations: [],
  variants: [
    {
      id: "State=Default",
      props: { State: "Default" },
      root: {
        id: "root",
        kind: "frame",
        name: "navigation",
        children: [
          { id: "heading", kind: "text", name: "Title", text: "Title" },
          {
            id: "button",
            kind: "frame",
            name: "button",
            children: [
              { id: "label", kind: "text", name: "Label", text: "Button" },
            ],
          },
        ],
      },
    },
    {
      id: "State=Disabled",
      props: { State: "Disabled" },
      root: { id: "root", kind: "frame", name: "navigation", children: [] },
    },
  ],
};
const partial: PartialRecipe = {
  nodeId: "set:1",
  type: "COMPONENT_SET",
  variants: [
    {
      nodeId: "component:1",
      variantId: "State=Default",
      root: {
        nodeId: "component:1",
        identity: "root",
        type: "COMPONENT",
        children: [
          { nodeId: "text:1", identity: "heading", type: "TEXT", children: [] },
        ],
      },
    },
  ],
};
function input() {
  return {
    entry: {
      id: "recipe:components/Test",
      kind: "recipe" as const,
      definition: canonical(target),
    },
    baseline: {
      nodeId: "set:1",
      definition: canonical({ ...target, pending: true, variants: [] }),
      snapshot: "partial snapshot",
    },
    nodeId: "set:1",
    actualSnapshot: "partial snapshot",
    partial,
    baselineRelease: "13.11.1",
    targetRelease: "13.11.1",
  };
}
test("caught initial recipe failure resumes stable identities even when visible names are incomplete", () => {
  const decision = recoveryDecision(input());
  assert.equal(decision.status, "resume");
  assert.deepEqual(decision.preserveIds, ["set:1", "component:1", "text:1"]);
  assert.deepEqual(partialRecipeProblems(partial, target), []);
});
test("recovery never bypasses drift, absent metadata, missing native nodes or changed release", () => {
  for (const change of [
    { actualSnapshot: "user edit" },
    { baseline: undefined },
    { nodeId: null },
    { nodeId: "different" },
    { baselineRelease: "older" },
  ])
    assert.equal(recoveryDecision({ ...input(), ...change }).status, "blocked");
});
test("unowned children, duplicate tags, removed variants and changed native types block recovery", () => {
  for (const mutate of [
    (p: PartialRecipe) =>
      p.variants[0].root.children.push({
        nodeId: "unowned",
        identity: null,
        type: "TEXT",
        children: [],
      }),
    (p: PartialRecipe) => p.variants.push(structuredClone(p.variants[0])),
    (p: PartialRecipe) => (p.variants[0].variantId = "removed"),
    (p: PartialRecipe) => (p.variants[0].root.children[0].type = "RECTANGLE"),
  ]) {
    const p = structuredClone(partial);
    mutate(p);
    assert.equal(
      recoveryDecision({ ...input(), partial: p }).status,
      "blocked",
    );
  }
});
test("fully applied asset remains on normal update path and cannot be reclassified pending", () => {
  assert.equal(
    recoveryDecision({
      ...input(),
      baseline: {
        nodeId: "set:1",
        definition: canonical(target),
        snapshot: "partial snapshot",
      },
    }).status,
    "not-pending",
  );
});
test("empty tagged component shell can be resumed without inventing layer ownership", () => {
  const p = structuredClone(partial);
  p.variants[0].root.identity = null;
  p.variants[0].root.children = [];
  assert.equal(recoveryDecision({ ...input(), partial: p }).status, "resume");
});
test("icon pending retry requires the same complete source definition", () => {
  const def = {
    id: "icon:test",
    name: "test",
    svg: "original",
    source: "test.svg",
  };
  const data = {
    entry: {
      id: "icon:icon:test",
      kind: "icon" as const,
      definition: canonical(def),
    },
    baseline: {
      nodeId: "icon:1",
      definition: canonical({ ...def, pending: true }),
      snapshot: "saved",
    },
    actualSnapshot: "saved",
    nodeId: "icon:1",
  };
  assert.equal(recoveryDecision(data).status, "resume");
  assert.equal(
    recoveryDecision({
      ...data,
      entry: {
        ...data.entry,
        definition: canonical({ ...def, svg: "different" }),
      },
    }).status,
    "blocked",
  );
});
