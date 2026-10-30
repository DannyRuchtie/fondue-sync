import { test } from "node:test";
import assert from "node:assert/strict";
import { snapshot } from "../src/snapshot";
function fixture() {
  const main: any = {
    id: "main",
    componentPropertyDefinitions: {
      "Label#1": { type: "TEXT", defaultValue: "Default" },
      "Unchanged#2": { type: "TEXT", defaultValue: "Inherited" },
    },
  };
  const child: any = {
    id: "label",
    type: "TEXT",
    characters: "Custom",
    fills: [{ color: "red" }],
    x: 4,
    y: 4,
    componentPropertyReferences: { characters: "Label#1" },
  };
  const instance: any = {
    id: "instance",
    type: "INSTANCE",
    name: "Button",
    width: 100,
    height: 36,
    children: [child],
    getMainComponentAsync: async () => main,
    componentProperties: {
      "Label#1": { type: "TEXT", value: "Custom" },
      "Unchanged#2": { type: "TEXT", value: "Inherited" },
    },
    overrides: [
      { id: "label", overriddenFields: ["characters"] },
      { id: "instance", overriddenFields: ["componentProperties"] },
    ],
  };
  child.parent = instance;
  return { main, child, instance };
}
test("inherited main text, paint, size and default properties do not become instance drift", async () => {
  const { main, child, instance } = fixture();
  const before = await snapshot(instance);
  child.fills = [{ color: "blue" }];
  instance.width = 120;
  instance.height = 40;
  main.componentPropertyDefinitions["Unchanged#2"].defaultValue =
    "New inherited";
  instance.componentProperties["Unchanged#2"].value = "New inherited";
  assert.equal(await snapshot(instance), before);
});
test("direct text overrides and native main linkage changes are detected", async () => {
  const { child, instance } = fixture();
  const before = await snapshot(instance);
  child.characters = "Local edit";
  instance.componentProperties["Label#1"].value = "Local edit";
  assert.notEqual(await snapshot(instance), before);
  child.characters = "Custom";
  instance.componentProperties["Label#1"].value = "Custom";
  assert.equal(await snapshot(instance), before);
  instance.getMainComponentAsync = async () => ({ id: "different-main" });
  assert.notEqual(await snapshot(instance), before);
});
test("native instance direct fill and resize overrides are captured", async () => {
  const { instance } = fixture();
  instance.fills = [{ color: "red" }];
  instance.overrides.push({
    id: "instance",
    overriddenFields: ["fills", "width"],
  });
  const before = await snapshot(instance);
  instance.width = 160;
  assert.notEqual(await snapshot(instance), before);
  instance.width = 100;
  instance.fills = [{ color: "green" }];
  assert.notEqual(await snapshot(instance), before);
});
test("auto layout inherited reflow is ignored while fixed geometry and absolute position remain protected", async () => {
  const child: any = {
    id: "child",
    type: "FRAME",
    width: 100,
    height: 40,
    x: 0,
    y: 0,
    layoutMode: "HORIZONTAL",
    primaryAxisSizingMode: "AUTO",
    counterAxisSizingMode: "AUTO",
    children: [],
  };
  const root: any = {
    id: "root",
    type: "FRAME",
    width: 100,
    height: 40,
    layoutMode: "VERTICAL",
    primaryAxisSizingMode: "AUTO",
    counterAxisSizingMode: "AUTO",
    children: [child],
  };
  child.parent = root;
  const before = await snapshot(root);
  root.height = 80;
  root.width = 140;
  child.width = 140;
  child.x = 20;
  child.y = 30;
  assert.equal(await snapshot(root), before);
  child.layoutPositioning = "ABSOLUTE";
  const absolute = await snapshot(root);
  child.x = 50;
  assert.notEqual(await snapshot(root), absolute);
  child.layoutPositioning = "AUTO";
  root.counterAxisSizingMode = "FIXED";
  const fixed = await snapshot(root);
  root.width = 180;
  assert.notEqual(await snapshot(root), fixed);
});
test("binding metadata changes are detected independently of inherited visual updates", async () => {
  const { instance } = fixture();
  let binding = '{"domain":"assets"}';
  instance.getSharedPluginData = (_ns: string, key: string) =>
    key === "data-binding" ? binding : "";
  const before = await snapshot(instance);
  binding = '{"domain":"brands"}';
  assert.notEqual(await snapshot(instance), before);
});
const variable = (id: string) => ({ type: "VARIABLE_ALIAS", id });
function boundFixture() {
  return {
    type: "FRAME",
    name: "Bound",
    width: 100,
    height: 40,
    paddingLeft: 8,
    itemSpacing: 4,
    cornerRadius: 4,
    strokeWeight: 1,
    boundVariables: {
      paddingLeft: variable("space"),
      itemSpacing: variable("gap"),
      topLeftRadius: variable("radius"),
      topRightRadius: variable("radius"),
      bottomLeftRadius: variable("radius"),
      bottomRightRadius: variable("radius"),
      strokeTopWeight: variable("border"),
      strokeRightWeight: variable("border"),
      strokeBottomWeight: variable("border"),
      strokeLeftWeight: variable("border"),
    },
    fills: [
      {
        type: "SOLID",
        color: { r: 1, g: 0, b: 0 },
        opacity: 0.75,
        boundVariables: { color: variable("surface") },
      },
    ],
    effects: [
      {
        type: "DROP_SHADOW",
        color: { r: 0, g: 0, b: 0, a: 0.2 },
        radius: 4,
        spread: 2,
        offset: { x: 1, y: 2 },
        visible: true,
        boundVariables: {
          color: variable("shadow"),
          radius: variable("blur"),
          spread: variable("spread"),
          offsetX: variable("x"),
          offsetY: variable("y"),
        },
      },
    ],
  };
}
test("resolved variable paints padding gap four corners/strokes and shadow fields do not become component drift", async () => {
  const node: any = boundFixture(),
    before = await snapshot(node);
  node.paddingLeft = 16;
  node.itemSpacing = 8;
  node.cornerRadius = 8;
  node.strokeWeight = 2;
  node.fills[0].color = { r: 0, g: 1, b: 0 };
  Object.assign(node.effects[0], {
    color: { r: 1, g: 0, b: 0, a: 1 },
    radius: 16,
    spread: 4,
    offset: { x: 5, y: 6 },
  });
  assert.equal(await snapshot(node), before);
  node.boundVariables.paddingLeft = variable("another-space");
  assert.notEqual(await snapshot(node), before);
});
test("unbinding a field or changing explicit paint opacity and unbound geometry remains protected", async () => {
  const node: any = boundFixture(),
    before = await snapshot(node);
  delete node.boundVariables.paddingLeft;
  assert.notEqual(await snapshot(node), before);
  node.boundVariables.paddingLeft = variable("space");
  node.fills[0].opacity = 0.5;
  assert.notEqual(await snapshot(node), before);
  node.fills[0].opacity = 0.75;
  node.paddingRight = 3;
  assert.notEqual(await snapshot(node), before);
});
test("bound font weight ignores resolved style but retains font family and other variable font axes", async () => {
  const node: any = {
    type: "TEXT",
    fontName: {
      family: "Inter",
      style: "Regular",
      variationSettings: { wght: 400, wdth: 100 },
    },
    fontSize: 14,
    boundVariables: {
      fontWeight: variable("weight"),
      fontSize: variable("font-size"),
    },
  };
  const before = await snapshot(node);
  node.fontName.style = "Bold";
  node.fontName.variationSettings.wght = 700;
  node.fontSize = 20;
  assert.equal(await snapshot(node), before);
  node.fontName.family = "Other";
  assert.notEqual(await snapshot(node), before);
});
test("direct instance override fields retain alias identity while resolved bound values can propagate", async () => {
  const { instance, child } = fixture();
  child.boundVariables = { paddingLeft: variable("space") };
  child.paddingLeft = 8;
  instance.overrides = [{ id: child.id, overriddenFields: ["paddingLeft"] }];
  const before = await snapshot(instance);
  child.paddingLeft = 16;
  assert.equal(await snapshot(instance), before);
  child.boundVariables.paddingLeft = variable("other");
  assert.notEqual(await snapshot(instance), before);
});
import { normalizeSavedSnapshot } from "../src/snapshot";
test("old persisted snapshots normalize with current alias comparison without altering variable values or metadata", async () => {
  const old: any = boundFixture();
  const current: any = boundFixture();
  current.paddingLeft = 24;
  current.fills[0].color = { r: 0, g: 0, b: 1 };
  assert.equal(
    normalizeSavedSnapshot(JSON.stringify(old)),
    await snapshot(current),
  );
  old.managed = { identity: "managed-identity" };
  const normalized = normalizeSavedSnapshot(JSON.stringify(old));
  assert.ok(normalized.includes("managed-identity"));
  assert.equal(normalizeSavedSnapshot(normalized), normalized);
  const token = {
    type: "VARIABLE",
    valuesByMode: { Light: { r: 1, g: 0, b: 0 } },
    resolvedType: "COLOR",
  };
  assert.notEqual(
    normalizeSavedSnapshot(JSON.stringify(token)),
    normalizeSavedSnapshot(
      JSON.stringify({
        ...token,
        valuesByMode: { Light: { r: 0, g: 1, b: 0 } },
      }),
    ),
  );
  assert.throws(() => normalizeSavedSnapshot("invalid-json"));
});

test("variant snapshots read property definitions only from the owning component set", async () => {
  let variantReads = 0;
  const owner: any = {
    type: "COMPONENT_SET",
    componentPropertyDefinitions: {
      State: { type: "VARIANT", defaultValue: "Default" },
    },
    children: [],
  };
  const variant: any = {
    type: "COMPONENT",
    parent: owner,
    name: "State=Default",
    children: [],
  };
  Object.defineProperty(variant, "componentPropertyDefinitions", {
    get() {
      variantReads++;
      throw Error("Native variant property getter is unavailable");
    },
  });
  owner.children.push(variant);
  const result = JSON.parse(await snapshot(owner));
  assert.equal(variantReads, 0);
  assert.ok(result.componentPropertyDefinitions.State);
  assert.equal(result.children[0].componentPropertyDefinitions, undefined);
});
