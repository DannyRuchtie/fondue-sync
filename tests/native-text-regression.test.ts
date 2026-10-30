import test from "node:test";
import assert from "node:assert/strict";
import { SyncEngine } from "../src/engine";
import type { Bundle } from "../src/schema";
/** Focused native text contract: fresh nodes begin empty, every font mutation requires a loaded font. */
function textApi(unavailable = new Set(["Diatype"])) {
  const loaded = new Set<string>(),
    calls: string[] = [];
  const data = () => {
    const map = new Map<string, string>();
    return {
      getSharedPluginData: (ns: string, key: string) =>
        map.get(ns + ":" + key) ?? "",
      setSharedPluginData: (ns: string, key: string, value: string) => {
        if (Buffer.byteLength(ns + key + value, "utf8") > 100000)
          throw Error("capacity");
        value ? map.set(ns + ":" + key, value) : map.delete(ns + ":" + key);
      },
      getSharedPluginDataKeys: (ns: string) =>
        [...map.keys()]
          .filter((k) => k.startsWith(ns + ":"))
          .map((k) => k.slice(ns.length + 1)),
    };
  };
  let seq = 0;
  const parent: any = {
    ...data(),
    id: "parent",
    children: [],
    appendChild(n: any) {
      this.children.push(n);
      n.parent = this;
    },
  };
  const api: any = {
    root: { ...data() },
    loadFontAsync: async (font: FontName) => {
      calls.push(font.family + ":" + font.style);
      if (unavailable.has(font.family))
        throw Error("Font is not available: " + font.family);
      loaded.add(font.family + ":" + font.style);
    },
    createText: () => {
      let font = { family: "Inter", style: "Regular" },
        characters = "",
        fontSize = 12;
      const requireFont = () => {
        if (!loaded.has(font.family + ":" + font.style))
          throw Error("Font must be loaded for native text mutation");
      };
      return {
        ...data(),
        id: String(++seq),
        type: "TEXT",
        name: "Text",
        fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }],
        strokes: [],
        width: 0,
        height: 14,
        resize(w: number, h: number) {
          this.width = w;
          this.height = h;
        },
        get fontName() {
          return font;
        },
        set fontName(next: FontName) {
          if (!loaded.has(next.family + ":" + next.style))
            throw Error("New font not loaded");
          font = next;
        },
        get characters() {
          return characters;
        },
        set characters(value: string) {
          requireFont();
          characters = value;
        },
        get fontSize() {
          return fontSize;
        },
        set fontSize(value: number) {
          requireFont();
          fontSize = value;
        },
      };
    },
  };
  return { api: api as PluginAPI, parent, calls };
}
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
test("plain guide text survives unavailable source font through loaded Inter fallback", async () => {
  const { api, parent, calls } = textApi();
  const engine = new SyncEngine(api, empty);
  const node = await engine.layer(
    {
      id: "title",
      name: "Title",
      kind: "text",
      fontSize: 24,
      text: "Fondue guide",
      fill: "#202020",
    },
    parent,
  );
  assert.equal(node.characters, "Fondue guide");
  assert.deepEqual(node.fontName, { family: "Inter", style: "Regular" });
  assert.deepEqual(calls, ["Diatype:Regular", "Inter:Regular"]);
  assert.ok(engine.warnings.some((w) => w.includes("Diatype")));
  assert.equal(node.fills[0].color.r, 32 / 255);
});
test("a completely unavailable fallback reproduces an empty first child and surfaces a font error", async () => {
  const { api, parent } = textApi(new Set(["Diatype", "Inter"]));
  const engine = new SyncEngine(api, empty);
  await assert.rejects(
    engine.layer(
      {
        id: "title",
        name: "Title",
        kind: "text",
        fontSize: 24,
        text: "Fondue guide",
      },
      parent,
    ),
    /Font is not available: Inter/,
  );
  assert.equal(parent.children.length, 1);
  assert.equal(parent.children[0].characters, "");
});
