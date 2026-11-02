import test from "node:test";
import assert from "node:assert/strict";
import { SyncEngine } from "../src/engine";
import type { Bundle } from "../src/schema";
const empty: Bundle = {
  schemaVersion: 1,
  release: "native-contract",
  fingerprint: "native-contract",
  provenance: {},
  tokens: [],
  styles: [],
  icons: [],
  recipes: [],
  inventory: [],
  gaps: [],
};
function apiFonts(available: FontName[], fail = new Set<string>()) {
  const calls: string[] = [];
  const store = new Map<string, string>();
  let mutations = 0;
  const api: any = {
    root: {
      getSharedPluginData: (ns: string, key: string) =>
        store.get(ns + ":" + key) ?? "",
      setSharedPluginData: () => {
        mutations++;
      },
    },
    listAvailableFontsAsync: async () =>
      available.map((fontName) => ({ fontName })),
    loadFontAsync: async (font: FontName) => {
      calls.push(font.family + ":" + font.style);
      if (
        fail.has(font.family) ||
        !available.some(
          (f) => f.family === font.family && f.style === font.style,
        )
      )
        throw Error("Font not available");
    },
    variables: {
      getVariableCollectionByIdAsync: async () => null,
      createVariableCollection: () => {
        mutations++;
        throw Error("No mutation expected");
      },
    },
    createPage: () => {
      mutations++;
      throw Error("No mutation expected");
    },
  };
  return { api: api as PluginAPI, calls, mutations: () => mutations };
}
test("exact confirmed ABC Diatype alias resolves released family/style without a substitute warning", async () => {
  const { api, calls } = apiFonts([{ family: "ABC Diatype", style: "Medium" }]);
  const engine = new SyncEngine(api, empty);
  engine.warnings = ["Font Diatype Medium unavailable; using Inter Medium."];
  assert.deepEqual(await engine.fontFor("Diatype", "Medium"), {
    family: "ABC Diatype",
    style: "Medium",
  });
  assert.deepEqual(calls, ["ABC Diatype:Medium"]);
  assert.deepEqual(engine.warnings, []);
});
test("available requested source font wins over its alias and Cranny loads exactly", async () => {
  const { api } = apiFonts([
    { family: "Diatype", style: "Regular" },
    { family: "ABC Diatype", style: "Regular" },
    { family: "Cranny", style: "Light" },
  ]);
  const engine = new SyncEngine(api, empty);
  assert.deepEqual(await engine.fontFor("Diatype", "Regular"), {
    family: "Diatype",
    style: "Regular",
  });
  assert.deepEqual(await engine.fontFor("Cranny", "Light"), {
    family: "Cranny",
    style: "Light",
  });
});
test("missing exact source style blocks explicitly even when Inter or a similar family is available", async () => {
  const { api, calls } = apiFonts([
    { family: "ABC Diatype", style: "Regular" },
    { family: "Inter", style: "Bold" },
    { family: "Diatype Pro", style: "Bold" },
  ]);
  const engine = new SyncEngine(api, empty);
  await assert.rejects(
    engine.fontFor("Diatype", "Bold"),
    /Required Fondue source font is unavailable: Diatype Bold/,
  );
  assert.deepEqual(calls, []);
  assert.equal(engine.warnings.length, 0);
});
test("missing required source fonts are preflighted before any collection node or metadata allocation", async () => {
  const { api, mutations } = apiFonts([{ family: "Inter", style: "Regular" }]);
  const bundle: Bundle = {
    ...empty,
    tokens: [
      {
        id: "space",
        name: "space",
        type: "FLOAT",
        collection: "Primitives",
        values: { Value: 8 },
        css: "8px",
      },
    ],
    styles: [
      {
        id: "body",
        type: "TEXT",
        name: "Body",
        fontFamily: "Diatype",
        fontStyle: "Regular",
        fontSize: 14,
        lineHeight: 18,
        letterSpacing: 0,
      },
    ],
  };
  const engine = new SyncEngine(api, bundle);
  const result = await engine.sync();
  assert.equal(result.complete, false);
  assert.ok(
    result.errors.some((error) =>
      error.includes("Required Fondue source font"),
    ),
  );
  assert.equal(mutations(), 0);
  assert.equal(Object.keys(engine.index.assets).length, 0);
});
