import test from "node:test";
import assert from "node:assert/strict";
import { planCuratedGalleries, syncCuratedGalleries } from "../src/galleries";
import { presentationFixture } from "./presentation-fixture";
import type { Bundle } from "../src/schema";
function setup(profiles = 5) {
  const f = presentationFixture(),
    items = f.recipe("Link", profiles),
    bundle = {
      ...f.source,
      recipes: items.map((item) => item.recipe),
      icons: [],
      examples: [],
    } as Bundle;
  const section = f.make("SECTION", "Link");
  f.sourcePage("Components").appendChild(section);
  f.index.sections = { "components/Link": section.id };
  for (const item of items) {
    section.appendChild(item.set);
    section.appendChild(item.guide);
  }
  return { ...f, items, bundle, section };
}
test("read-only plan audits exact native masters/guides and picks first source variants without clones", async () => {
  const f = setup(),
    before = f.stats().nodeCount;
  const plan = await planCuratedGalleries(f.api, f.bundle, f.index);
  assert.equal(f.stats().nodeCount, before);
  assert.equal(plan.moves.length, 10);
  assert.equal(plan.groups.length, 1);
  assert.equal(plan.groups[0].previews.length, 5);
  assert.deepEqual(
    plan.groups[0].previews.map((p) => p.mainId),
    f.items.map((item) => item.main.id),
  );
  assert.ok(plan.moves.every((move) => move.fromParentId === f.section.id));
  assert.equal(f.index.presentationInstances, undefined);
});
test("consumer gallery reuses section ID and parks originals only after exact move audit is saved", async () => {
  const f = setup();
  const ids = f.items.flatMap((item) => [
    item.set.id,
    item.main.id,
    item.alternate.id,
    item.guide.id,
  ]);
  const guidePositions = f.items.map((item) => [
    item.guide.id,
    item.guide.parent.id,
  ]);
  let auditSavedBeforeMoves = false;
  const save = () => {
    if (f.index.galleryMoveAudits?.length)
      auditSavedBeforeMoves = f.items.every(
        (item) => item.set.parent.id === f.section.id,
      );
    f.save();
  };
  const plan = await planCuratedGalleries(f.api, f.bundle, f.index);
  const result = await syncCuratedGalleries(f.api, f.bundle, f.index, save, {
    approvedMoveIds: plan.moves.map((move) => move.nodeId),
  });
  assert.equal(result.auditedMoves, 10);
  assert.equal(f.index.sections!["components/Link"], f.section.id);
  assert.equal(f.index.galleryMoveAudits![0].moves.length, 10);
  assert.ok(f.auditAtMove.some((e) => e.audit.moves.length === 10));
  for (const id of ids) assert.ok(f.nodes.has(id));
  const masterPage = f.index.pages["Library masters - Components"];
  for (const item of f.items) {
    assert.equal(item.set.parent.id, masterPage);
    assert.equal(item.guide.parent.id, masterPage);
    assert.equal(item.main.parent.id, item.set.id);
  }
  assert.equal(result.sections[0].previewIds.length, 5);
  assert.ok(
    f.section.children.every((node: any) => node.type !== "COMPONENT_SET"),
  );
  const guide = f.nodes.get(result.sections[0].guideId);
  assert.ok(guide.children.length <= 5);
  for (const text of guide.children) assert.ok(text.textStyleId);
});
test("repeat sync does not duplicate previews or reset native variant overrides and leaves unrelated notes intact", async () => {
  const f = setup(6);
  const note = f.make("FRAME", "User note");
  note.x = 2000;
  note.y = 12;
  note.resize(180, 64);
  f.section.appendChild(note);
  await syncCuratedGalleries(f.api, f.bundle, f.index, f.save);
  const refs = { ...f.index.presentationInstances },
    count = f.stats().nodeCount;
  const instance = f.nodes.get(refs["profile:" + f.items[0].recipe.id]);
  instance.swapComponent(f.items[0].alternate);
  const again = await syncCuratedGalleries(f.api, f.bundle, f.index, f.save);
  assert.equal(f.stats().nodeCount, count);
  assert.equal(again.createdNodeIds.length, 0);
  assert.deepEqual(f.index.presentationInstances, refs);
  assert.equal(
    (await instance.getMainComponentAsync()).id,
    f.items[0].alternate.id,
  );
  assert.equal(note.parent.id, f.section.id);
  assert.equal(note.x, 2000);
  assert.equal(note.y, 12);
  const document = f.nodes.get(
    f.index.presentationNodes!["gallery/components/Link/document"],
  );
  assert.ok(document.y > note.y + note.height);
});
test("wrapping Auto Layout galleries inherit source spacing changes without scaling natural instances", async () => {
  const f = setup(8);
  await syncCuratedGalleries(f.api, f.bundle, f.index, f.save);
  const grid = f.nodes.get(
    f.index.presentationNodes!["gallery/components/Link/grid"],
  );
  assert.equal(grid.layoutWrap, "WRAP");
  assert.equal(grid.boundVariables.itemSpacing.id, "v:spacing-large");
  assert.equal(grid.boundVariables.counterAxisSpacing.id, "v:spacing-large");
  const before = grid.height;
  f.variables.get("v:spacing-large").valuesByMode.Value = 48;
  assert.ok(grid.height > before);
  for (const instanceId of Object.values(f.index.presentationInstances!)) {
    const instance = f.nodes.get(instanceId),
      main = await instance.getMainComponentAsync();
    assert.equal(instance.width, main.width);
    assert.equal(instance.height, main.height);
  }
  const guide = f.nodes.get(
    f.index.presentationNodes!["gallery/components/Link/guide"],
  );
  assert.equal(guide.layoutMode, "VERTICAL");
  assert.equal(guide.boundVariables.itemSpacing.id, "v:spacing-medium");
});
test("icon gallery uses exact24px optical masters and does not silently pick a nearest size", async () => {
  const f = presentationFixture();
  const iconSet = f.make("COMPONENT_SET", "Icon"),
    small = f.make("COMPONENT", "16"),
    main = f.make("COMPONENT", "24");
  small.resize(16, 16);
  small.setSharedPluginData("fondue_sync", "optical-size", "16");
  main.resize(24, 24);
  main.setSharedPluginData("fondue_sync", "optical-size", "24");
  iconSet.appendChild(small);
  iconSet.appendChild(main);
  f.sourcePage("Icons").appendChild(iconSet);
  f.index.assets["icon:icon:test"] = { id: iconSet.id, kind: "icon" };
  const bundle = {
    ...f.source,
    recipes: [],
    icons: [{ id: "icon:test", name: "test", svg: "", source: "icon.svg" }],
    examples: [],
  } as Bundle;
  const plan = await planCuratedGalleries(f.api, bundle, f.index);
  assert.equal(plan.groups[0].previews[0].mainId, main.id);
  const report = await syncCuratedGalleries(f.api, bundle, f.index, f.save);
  const instance = f.nodes.get(report.sections[0].previewIds[0]);
  assert.equal(instance.width, 24);
  assert.equal(instance.height, 24);
  const no24 = { ...f.index, assets: { ...f.index.assets } };
  main.setSharedPluginData("fondue_sync", "optical-size", "20");
  const missing = await planCuratedGalleries(f.api, bundle, no24);
  assert.equal(missing.groups[0].previews.length, 0);
  assert.ok(missing.warnings.some((w) => w.includes("exact 24px")));
});
test("unapproved moves and missing presentation identities stop before recreating or deleting assets", async () => {
  const f = setup(1);
  const count = f.stats().nodeCount;
  await assert.rejects(
    syncCuratedGalleries(f.api, f.bundle, f.index, f.save, {
      approvedMoveIds: [],
    }),
    /Unapproved exact-ID/,
  );
  assert.equal(f.stats().nodeCount, count);
  assert.equal(f.items[0].set.parent.id, f.section.id);
  await syncCuratedGalleries(f.api, f.bundle, f.index, f.save);
  const key = "profile:" + f.items[0].recipe.id;
  f.nodes.delete(f.index.presentationInstances![key]);
  const after = f.stats().nodeCount;
  const broken = await syncCuratedGalleries(f.api, f.bundle, f.index, f.save);
  assert.equal(broken.complete, false);
  assert.ok(
    broken.plan.conflicts.some((c) =>
      c.reason.includes("Managed preview missing"),
    ),
  );
  assert.equal(f.stats().nodeCount, after);
});

test("source first-variant changes are rejected explicitly instead of leaving a silently stale preview", async () => {
  const f = setup(1);
  await syncCuratedGalleries(f.api, f.bundle, f.index, f.save);
  const key = "profile:" + f.items[0].recipe.id,
    id = f.index.presentationInstances![key],
    instance = f.nodes.get(id);
  f.items[0].recipe.variants[0].id = "new-first";
  f.items[0].alternate.setSharedPluginData(
    "fondue_sync",
    "variant",
    "new-first",
  );
  const before = f.stats().nodeCount;
  const changed = await syncCuratedGalleries(f.api, f.bundle, f.index, f.save);
  assert.equal(changed.complete, false);
  assert.ok(
    changed.plan.conflicts.some((c) =>
      c.reason.includes("First source variant identity changed"),
    ),
  );
  assert.equal(f.stats().nodeCount, before);
  assert.equal(f.index.presentationInstances![key], id);
  assert.equal((await instance.getMainComponentAsync()).id, f.items[0].main.id);
});
test("local swaps outside the owned source profile are preserved and block presentation writes", async () => {
  const f = setup(1);
  await syncCuratedGalleries(f.api, f.bundle, f.index, f.save);
  const key = "profile:" + f.items[0].recipe.id,
    instance = f.nodes.get(f.index.presentationInstances![key]),
    foreign = f.make("COMPONENT", "User component");
  f.sourcePage("Components").appendChild(foreign);
  instance.swapComponent(foreign);
  const before = f.stats().nodeCount;
  const result = await syncCuratedGalleries(f.api, f.bundle, f.index, f.save);
  assert.equal(result.complete, false);
  assert.ok(
    result.plan.conflicts.some((c) =>
      c.reason.includes("outside its source profile"),
    ),
  );
  assert.equal((await instance.getMainComponentAsync()).id, foreign.id);
  assert.equal(f.stats().nodeCount, before);
});
test("fresh imports allocate sections through the ledger and park legacy indexed family captions without deleting them", async () => {
  const f = setup(1);
  delete f.index.sections;
  const caption = f.make("FRAME", "Legacy indexed caption");
  f.sourcePage("Components").appendChild(caption);
  f.index.sectionGuides = { "components/Link": caption.id };
  const plan = await planCuratedGalleries(f.api, f.bundle, f.index);
  assert.ok(
    plan.moves.some(
      (move) =>
        move.nodeId === caption.id &&
        move.assetKey === "sectionGuide:components/Link",
    ),
  );
  const result = await syncCuratedGalleries(f.api, f.bundle, f.index, f.save);
  assert.equal(result.complete, true);
  assert.ok(f.index.sections!["components/Link"]);
  assert.equal(
    caption.parent.id,
    f.index.pages["Library masters - Components"],
  );
  assert.ok(f.nodes.has(caption.id));
  const section = f.nodes.get(f.index.sections!["components/Link"]);
  assert.equal(section.type, "SECTION");
});
