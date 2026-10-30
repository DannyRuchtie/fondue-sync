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
