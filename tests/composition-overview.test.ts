import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compositionOverview } from "../src/composition-overview.mjs";
import type { Bundle } from "../src/schema";

const bundle = JSON.parse(
  readFileSync(
    new URL("../bundles/fondue-13.11.1.json", import.meta.url),
    "utf8",
  ),
) as Bundle;

test("composition overview reconciles every source family with actual recipe slots", () => {
  const rows = compositionOverview(bundle);
  assert.equal(rows.length, bundle.inventory.length);
  assert.equal(new Set(rows.map((r) => r.key)).size, rows.length);
  const table = rows.find((r) => r.key === "components:Table")!;
  assert.deepEqual([...new Set(table.slots.map((s) => s.name))].sort(), [
    "Cells",
    "Content",
    "Header content",
    "Rows",
  ]);
  assert.equal(table.state, "Available");
  const flyout = rows.find((r) => r.key === "components:Flyout")!;
  assert.equal(flyout.state, "Available");
  assert.deepEqual([...new Set(flyout.slots.map((s) => s.name))].sort(), [
    "Actions",
    "Body",
    "Content",
  ]);
  const dialog = rows.find((r) => r.key === "components:Dialog")!;
  assert.equal(dialog.state, "Available");
  assert.ok(dialog.slots.some((slot) => slot.name === "Side content"));
  assert.equal(
    rows.find((r) => r.key === "components:Button")!.state,
    "No slot planned",
  );
});

test("new source families appear without a manual registry entry and require review", () => {
  const next = structuredClone(bundle);
  next.inventory.push({
    ...next.inventory[0],
    package: "@frontify/fondue/components",
    name: "FuturePanel",
  });
  const row = compositionOverview(next).find(
    (r) => r.key === "components:FuturePanel",
  )!;
  assert.equal(row.state, "Needs review");
  assert.equal(row.mode, "review");
  assert.deepEqual(row.recipeIds, []);
  assert.deepEqual(row.slots, []);
});

test("planned regions never count as implemented slots when their recipes are absent", () => {
  const next = structuredClone(bundle);
  next.recipes = next.recipes.filter(
    (r) => r.id !== "components/Table.ContentCell",
  );
  assert.equal(
    compositionOverview(next).find((r) => r.key === "components:Table")!.state,
    "Partly available",
  );
  next.recipes = next.recipes.filter(
    (r) => !r.id.startsWith("components/Table."),
  );
  const row = compositionOverview(next).find(
    (r) => r.key === "components:Table",
  )!;
  assert.equal(row.state, "Needs slots");
  assert.equal(row.slots.length, 0);
  assert.deepEqual(row.regions, ["Rows", "Cells", "Cell content"]);
});

test("planned or removed source families remain visible through versioned policies", () => {
  const next = structuredClone(bundle);
  next.inventory = next.inventory.filter((entry) => entry.name !== "Dialog");
  assert.equal(
    compositionOverview(next).find((r) => r.key === "components:Dialog")!.state,
    "Not in source",
  );
  const rows = compositionOverview(bundle, {
    "components:FuturePanel": {
      mode: "content",
      regions: ["Body"],
      reason: "Planned component.",
    },
  });
  const planned = rows.find((r) => r.key === "components:FuturePanel")!;
  assert.equal(planned.state, "Not in source");
  assert.deepEqual(planned.regions, ["Body"]);
  assert.deepEqual(planned.recipeIds, []);
});

test("all 21 required families have complete slot contracts in every supported state", () => {
  const rows = compositionOverview(bundle).filter((row) => row.entryRecipeId);
  assert.equal(rows.length, 21);
  assert.ok(
    rows.every((row) => row.state === "Available"),
    JSON.stringify(rows.filter((row) => row.state !== "Available")),
  );
  const next = structuredClone(bundle);
  const flyout = next.recipes.find(
    (r) => r.id === "components/Flyout.Editable",
  )!;
  const body = flyout.variants[0].root.children!.find((n) => n.id === "body")!;
  delete body.contentSlot;
  assert.equal(
    compositionOverview(next).find((row) => row.key === "components:Flyout")!
      .state,
    "Partly available",
  );
});
