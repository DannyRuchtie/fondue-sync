import test from "node:test";
import assert from "node:assert/strict";
import {
  colorReference,
  naturalShadeCompare,
  syncColorsPage,
} from "../src/colors";
import { presentationFixture } from "./presentation-fixture";

test("consumer semantic roles are grouped by use and all source colors are accounted for", () => {
  const f = presentationFixture(),
    model = colorReference(f.source);
  assert.deepEqual(
    model.semantic.map((g) => g.id),
    [
      "text-icons",
      "surfaces",
      "borders",
      "feedback-error",
      "feedback-warning",
      "feedback-success",
      "containers",
      "highlight-focus",
      "charts",
      "effects",
    ],
  );
  assert.ok(
    model.semantic
      .find((g) => g.id === "text-icons")!
      .tokens.some((t) => t.id === "color-primary-default"),
  );
  assert.ok(
    model.semantic
      .find((g) => g.id === "borders")!
      .tokens.every((t) => t.id.startsWith("color-line-")),
  );
  const ids = [
    ...model.semantic.flatMap((g) => g.tokens),
    ...model.palettes.flatMap((g) => g.tokens),
    ...model.implementation,
  ].map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(
    ids.length,
    f.source.tokens.filter((t) => t.type === "COLOR").length,
  );
});
test("primitive shades use numeric order and hue families rather than alphabetical interleaving", () => {
  const f = presentationFixture(),
    model = colorReference(f.source);
  assert.deepEqual(
    model.palettes.map((p) => p.name),
    ["Neutral", "Error", "Warning", "Success", "Marker"],
  );
  assert.deepEqual(
    [
      "color-neutral-100",
      "color-neutral-10",
      "color-neutral-05",
      "color-neutral-00",
      "color-neutral-20",
    ].sort(naturalShadeCompare),
    [
      "color-neutral-00",
      "color-neutral-05",
      "color-neutral-10",
      "color-neutral-20",
      "color-neutral-100",
    ],
  );
  for (const p of model.palettes)
    assert.deepEqual(
      p.tokens.map((t) => Number(t.id.match(/-(\d+)$/)![1])),
      p.tokens
        .map((t) => Number(t.id.match(/-(\d+)$/)![1]))
        .sort((a, b) => a - b),
    );
});
test("native reference uses exact Light/Dark modes, keeps source data and remains idempotent", async () => {
  const f = presentationFixture();
  const colors = f.sourcePage("Colors"),
    note = f.make("FRAME", "My unrelated note");
  note.resize(200, 60);
  note.x = 1400;
  note.y = 20;
  colors.appendChild(note);
  const original = JSON.stringify([...f.variables]);
  const first = await syncColorsPage(f.api, f.source, f.index, f.save);
  assert.equal(first.counts.semantic, 76);
  assert.equal(first.modePairs.length, 76);
  assert.equal(JSON.stringify([...f.variables]), original);
  for (const p of first.modePairs) {
    const light = f.nodes.get(
        f.index.presentationNodes!["colors/role/" + p.tokenId + "/Light"],
      ),
      dark = f.nodes.get(
        f.index.presentationNodes!["colors/role/" + p.tokenId + "/Dark"],
      );
    assert.equal(light.explicitVariableModes[p.collectionId], p.light);
    assert.equal(dark.explicitVariableModes[p.collectionId], p.dark);
  }
  const ids = Object.values(f.index.presentationNodes!),
    count = f.stats().nodeCount;
  const second = await syncColorsPage(f.api, f.source, f.index, f.save);
  assert.deepEqual(Object.values(f.index.presentationNodes!), ids);
  assert.equal(second.createdNodeIds.length, 0);
  assert.equal(f.stats().nodeCount, count);
  assert.equal(note.parent.id, colors.id);
  assert.equal(note.x, 1400);
  assert.equal(note.y, 20);
  for (const node of f.nodes.values())
    if (node.type === "TEXT")
      assert.ok(
        node.textStyleId,
        "Canonical style must survive native font setters",
      );
});
test("semantic samples retain role paint bindings and native Auto Layout responds to source gap updates", async () => {
  const f = presentationFixture();
  await syncColorsPage(f.api, f.source, f.index, f.save);
  const light = f.nodes.get(
    f.index.presentationNodes![
      "colors/role/color-primary-default/Light/sample"
    ],
  );
  assert.equal(
    light.fills[0].boundVariables.color.id,
    "v:color-primary-default",
  );
  const grid = f.nodes.get(
    f.index.presentationNodes!["colors/semantic/containers/grid"],
  );
  assert.equal(grid.layoutWrap, "WRAP");
  assert.equal(grid.boundVariables.itemSpacing.id, "v:spacing-large");
  assert.equal(grid.boundVariables.counterAxisSpacing.id, "v:spacing-large");
  const before = grid.height;
  f.variables.get("v:spacing-large").valuesByMode.Value = 40;
  assert.ok(
    grid.height > before,
    "Native wrapped rows must reflow when shared gaps change",
  );
  const card = f.nodes.get(
    f.index.presentationNodes!["colors/role/color-container-error-default"],
  );
  assert.equal(card.layoutMode, "VERTICAL");
  assert.equal(card.boundVariables.paddingLeft.id, "v:spacing-medium");
});
test("missing source modes stop before creating presentation nodes or duplicate pages", async () => {
  const f = presentationFixture();
  f.collections.get("Semantic").modes = [{ name: "Light", modeId: "L" }];
  const before = f.stats().nodeCount;
  await assert.rejects(
    syncColorsPage(f.api, f.source, f.index, f.save),
    /Light\/Dark modes/,
  );
  assert.equal(f.stats().nodeCount, before);
  assert.equal(f.index.pages.Colors, undefined);
});

test("repeat paint assignments retain exact resolved colors and alpha in explicit Light and Dark modes", async () => {
  const f = presentationFixture();
  await syncColorsPage(f.api, f.source, f.index, f.save);
  await syncColorsPage(f.api, f.source, f.index, f.save);
  for (const [key, id] of Object.entries(f.index.presentationNodes!)) {
    const node = f.nodes.get(id);
    for (const paint of [...(node.fills ?? []), ...(node.strokes ?? [])]) {
      const alias = paint.boundVariables?.color;
      if (!alias) continue;
      const expected = f.variables.get(alias.id).resolveForConsumer(node).value;
      assert.deepEqual(
        paint.color,
        { r: expected.r, g: expected.g, b: expected.b },
        key,
      );
      assert.equal(paint.opacity, expected.a ?? 1, key);
    }
  }
  const sample = f.nodes.get(
    f.index.presentationNodes![
      "colors/palette/neutral/color-neutral-05/sample"
    ],
  );
  assert.notDeepEqual(sample.fills[0].color, { r: 0, g: 0, b: 0 });
});
