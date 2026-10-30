import test from "node:test";
import assert from "node:assert/strict";
import {
  uniqueSentences,
  familyDocumentation,
  profileCaption,
} from "../src/documentation";
import {
  dedupeLimitations,
  normalizeRecipeDocumentation,
} from "../recipes/documentation.mjs";
import { presentationFixture } from "./presentation-fixture";
test("builder and renderer remove repeated paragraphs and repeated sentences without dropping distinct caveats", () => {
  const repeated = Array(100)
    .fill("Static text follows the source. Native behavior remains in React.")
    .concat(["Keyboard-only states need native review."]);
  const expected = [
    "Static text follows the source.",
    "Native behavior remains in React.",
    "Keyboard-only states need native review.",
  ];
  assert.deepEqual(uniqueSentences(repeated), expected);
  assert.deepEqual(dedupeLimitations(repeated), expected);
  const recipe = {
    limitations: repeated,
    documentation: {
      purpose: "Use a link.",
      usage: "Use a link.",
      description: repeated.join("\n\n"),
    },
  };
  normalizeRecipeDocumentation(recipe);
  assert.equal(recipe.limitations.length, 3);
  assert.equal(
    (recipe.documentation.description.match(/Static text follows/g) || [])
      .length,
    1,
  );
});
test("one concise family guide unions controls but does not repeat the whole coverage paragraph per profile", () => {
  const f = presentationFixture(),
    items = f.recipe("Link", 30),
    recipes = items.map((i) => i.recipe);
  recipes.forEach((r, i) => {
    r.limitations = Array(100).fill("A distinct source caveat.");
    r.variants[0].props = {
      color: "primary",
      size: String(i),
      weight: "medium",
    };
  });
  const doc = familyDocumentation(recipes);
  assert.equal(doc.profileCount, 30);
  assert.equal(doc.variantCount, 30);
  assert.deepEqual(doc.notes, ["A distinct source caveat."]);
  assert.ok(
    doc.controls.some((line) => line.includes("30 represented values")),
  );
  assert.ok(doc.controls.length <= 6);
  assert.ok(doc.notes.join(" ").length < 300);
  assert.equal(profileCaption(recipes[0]), "Primary / 0 / Medium");
});

test("released Link and Text captions distinguish container roles", async () => {
  const { readFile } = await import("node:fs/promises");
  const bundle = JSON.parse(
    await readFile(
      new URL("../bundles/fondue-13.11.1.json", import.meta.url),
      "utf8",
    ),
  );
  for (const role of ["error", "success", "warning"]) {
    const recipe = bundle.recipes.find(
      (r: any) =>
        r.id.startsWith("components/Link/") &&
        r.variants[0]?.props.onContainer === role,
    );
    assert.ok(recipe, "released Link onContainer " + role);
    assert.ok(
      profileCaption(recipe).startsWith(
        "On " + role[0].toUpperCase() + role.slice(1) + " / ",
      ),
    );
    assert.ok(profileCaption(recipe).split(" / ").length <= 3);
  }
  for (const role of ["neutral", "selected", "positive"]) {
    const recipe = bundle.recipes.find(
      (r: any) => r.id === "components/Text/boxColor-" + role,
    );
    assert.ok(recipe);
    assert.ok(
      profileCaption(recipe).startsWith(
        "Box " + role[0].toUpperCase() + role.slice(1) + " / ",
      ),
    );
  }
});
