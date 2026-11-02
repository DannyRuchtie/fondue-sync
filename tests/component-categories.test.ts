import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  componentCategory,
  componentAssetName,
} from "../src/component-categories.mjs";

test("categories follow source families and leave non-component domains intact", () => {
  const recipe = {
    package: "@frontify/fondue/components",
    name: "Accordion/pill",
  };
  assert.equal(componentAssetName(recipe), "Content/Accordion/pill");
  assert.equal(
    componentAssetName({ ...recipe, name: "Button/variant=default" }),
    "Buttons/Button/variant=default",
  );
  assert.equal(
    componentCategory({ package: "components", name: "NewComponent" }),
    "Other",
  );
  for (const pkg of [
    "@frontify/fondue/rte",
    "@frontify/fondue/charts",
    "fondue-sync/patterns",
  ]) {
    assert.equal(
      componentAssetName({ package: pkg, name: "Button" }),
      "Button",
    );
  }
});

test("every bundled component family is categorized with unique taxonomy entries", () => {
  const bundle = JSON.parse(
    fs.readFileSync(
      new URL("../bundles/fondue-13.11.1.json", import.meta.url),
      "utf8",
    ),
  );
  for (const recipe of bundle.recipes.filter((r: any) =>
    r.package.endsWith("/components"),
  )) {
    assert.notEqual(componentCategory(recipe), "Other", recipe.name);
    assert.equal(recipe.assetName, componentAssetName(recipe));
    assert.equal(recipe.libraryCategory, componentCategory(recipe));
  }
  const taxonomy = JSON.parse(
    fs.readFileSync(
      new URL("../src/component-categories.json", import.meta.url),
      "utf8",
    ),
  );
  const families = Object.values(taxonomy).flat();
  assert.equal(new Set(families).size, families.length);
});
