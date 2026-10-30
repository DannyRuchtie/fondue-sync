import test from "node:test";
import assert from "node:assert/strict";
import { organizeSections, type SectionIndex } from "../src/sections";
import type { Bundle } from "../src/schema";

function fixture() {
  let sequence = 0,
    sectionsCreated = 0,
    captionsCreated = 0,
    saves = 0;
  const nodes = new Map<string, any>(),
    loadedFonts = new Set<string>();
  function node(type: string, name: string, width = 240, height = 160): any {
    const metadata = new Map<string, string>();
    const value: any = {
      id: `${++sequence}`,
      type,
      name,
      width,
      height,
      x: 0,
      y: 0,
      children: [],
      parent: null,
      appendChild(child: any) {
        if (child.parent)
          child.parent.children.splice(child.parent.children.indexOf(child), 1);
        child.parent = this;
        this.children.push(child);
      },
      resize(w: number, h: number) {
        assert.ok(w > 0 && h > 0);
        this.width = w;
        this.height = h;
      },
      loadAsync: async () => {},
      remove() {
        throw Error("Organizer must never delete an existing asset");
      },
      getSharedPluginData: (_ns: string, key: string) =>
        metadata.get(key) ?? "",
      setSharedPluginData: (_ns: string, key: string, text: string) =>
        metadata.set(key, text),
    };
    if (type === "SECTION") {
      sectionsCreated++;
      value.resizeWithoutConstraints = (w: number, h: number) => {
        assert.ok(w >= 0.01 && h >= 0.01);
        value.width = w;
        value.height = h;
      };
      Object.defineProperty(value, "layoutMode", {
        set() {
          throw Error("Native SectionNode has no Auto Layout");
        },
      });
    }
    if (type === "TEXT") {
      let text = "";
      Object.defineProperty(value, "characters", {
        get: () => text,
        set: (content: string) => {
          assert.ok(
            loadedFonts.has("Diatype/Regular"),
            "Font must load before writing native caption text",
          );
          text = content;
          value.height = Math.max(
            20,
            Math.ceil(content.length / Math.max(1, value.width / 7)) * 20,
          );
        },
      });
    }
    nodes.set(value.id, value);
    return value;
  }
  const index: SectionIndex = { assets: {}, pages: {} };
  for (const key of [
    "Components",
    "Charts",
    "Rich text",
    "Product patterns",
    "Documentation",
    "Icons",
    "Examples",
  ]) {
    index.pages[key] = node("PAGE", "Fondue / " + key).id;
  }
  const page = (key: string) => nodes.get(index.pages[key]);
  const own = (
    key: string,
    kind: string,
    pageKey: string,
    width = 240,
    height = 160,
  ) => {
    const asset = node(
      kind === "recipe" || kind === "icon" ? "COMPONENT_SET" : "FRAME",
      key,
      width,
      height,
    );
    page(pageKey).appendChild(asset);
    index.assets[key] = { id: asset.id, kind };
    return asset;
  };
  const bundle: Bundle = {
    schemaVersion: 1,
    release: "test",
    fingerprint: "test",
    provenance: {},
    tokens: [],
    styles: [],
    icons: [],
    recipes: [],
    inventory: [],
    gaps: [],
    examples: [],
  };
  const recipe = (
    id: string,
    name: string,
    pkg = "@frontify/fondue/components",
    width = 240,
    height = 160,
  ) => {
    bundle.recipes.push({
      id,
      name,
      package: pkg,
      source: [],
      status: "partial",
      limitations: [],
      variants: [],
    });
    const destination = pkg.includes("charts")
      ? "Charts"
      : pkg.includes("rte")
        ? "Rich text"
        : pkg.includes("patterns")
          ? "Product patterns"
          : "Components";
    return {
      asset: own("recipe:" + id, "recipe", destination, width, height),
      guide: own("guide:" + id, "guide", "Documentation", 700, 380),
    };
  };
  const api: any = {
    getNodeByIdAsync: async (id: string) => nodes.get(id) ?? null,
    createSection: () => node("SECTION", "Section"),
    createPage: () => node("PAGE", "Page"),
    createText: () => {
      captionsCreated++;
      return node("TEXT", "Text", 650, 20);
    },
    loadFontAsync: async ({ family, style }: any) => {
      loadedFonts.add(family + "/" + style);
    },
  };
  const metadata = {
    read: (asset: any, key: string) => asset.getSharedPluginData("", key),
    write: (asset: any, key: string, value: string) =>
      asset.setSharedPluginData("", key, value),
  };
  const save = () => {
    saves++;
  };
  return {
    node,
    nodes,
    index,
    page,
    own,
    recipe,
    bundle,
    api,
    metadata,
    save,
    stats: () => ({ sectionsCreated, captionsCreated, saves }),
  };
}

test("one native section per component family pairs all profiles with existing guides and preserves identities", async () => {
  const f = fixture();
  const small = f.recipe("components/Button/default", "Button/default");
  const positive = f.recipe(
    "components/Button/positive",
    "Button/positive",
    "@frontify/fondue/components",
    600,
    420,
  );
  const text = f.recipe("components/Text", "Text");
  const note = f.node("FRAME", "My local notes", 300, 90);
  note.x = 420;
  note.y = 10;
  f.page("Components").appendChild(note);
  const userSection = f.node("SECTION", "Button", 300, 200);
  userSection.x = 100;
  userSection.y = 140;
  f.page("Components").appendChild(userSection);
  const originalIds = [...f.nodes.keys()];
  const result = await organizeSections(
    f.api,
    f.bundle,
    f.index,
    f.save,
    f.metadata,
  );
  assert.equal(result.sections.length, 2);
  const button = f.nodes.get(f.index.sections!["components/Button"]);
  assert.equal(button.type, "SECTION");
  assert.notEqual(button.id, userSection.id);
  assert.equal(small.asset.parent.id, button.id);
  assert.equal(positive.asset.parent.id, button.id);
  assert.equal(small.guide.parent.id, button.id);
  assert.equal(positive.guide.parent.id, button.id);
  assert.equal(small.guide.x, small.asset.x + small.asset.width + 96);
  assert.equal(small.guide.y, small.asset.y);
  assert.ok(positive.asset.y > small.guide.y + small.guide.height);
  assert.ok(text.asset.parent.id !== button.id);
  assert.equal(note.parent.id, f.page("Components").id);
  assert.equal(note.x, 420);
  assert.equal(note.y, 10);
  assert.equal(userSection.parent.id, f.page("Components").id);
  assert.equal(userSection.x, 100);
  assert.equal(userSection.y, 140);
  assert.ok(button.y > userSection.y + userSection.height);
  for (const id of originalIds) assert.ok(f.nodes.has(id), id);
  assert.equal(
    f.page("Documentation").children.length,
    0,
    "Old documentation page remains, guides move without deletion",
  );
});

test("repeated organization reuses sections and preserves unrelated section children", async () => {
  const f = fixture(),
    set = f.recipe("components/DatePicker", "DatePicker");
  await organizeSections(f.api, f.bundle, f.index, f.save, f.metadata);
  const sectionId = f.index.sections!["components/DatePicker"],
    section = f.nodes.get(sectionId);
  const note = f.node("FRAME", "Local note", 300, 90);
  note.x = 900;
  note.y = 200;
  section.appendChild(note);
  const before = f.stats().sectionsCreated;
  await organizeSections(f.api, f.bundle, f.index, f.save, f.metadata);
  assert.equal(f.index.sections!["components/DatePicker"], sectionId);
  assert.equal(f.stats().sectionsCreated, before);
  assert.equal(note.parent.id, sectionId);
  assert.equal(note.x, 900);
  assert.equal(note.y, 200);
  assert.ok(set.asset.y >= note.y + note.height + 96);
  assert.equal(set.asset.y, set.guide.y);
  assert.ok(section.width >= note.x + note.width + 64);
});

test("charts, rte, product patterns and icons use correct pages while example captions use bundle documentation", async () => {
  const f = fixture();
  f.recipe("charts/BarChart", "BarChart", "@frontify/fondue/charts");
  f.recipe("rte/Toolbar", "Toolbar", "@frontify/fondue/rte");
  f.recipe(
    "patterns/NavigationShell",
    "NavigationShell",
    "fondue-sync/patterns",
  );
  f.bundle.icons.push({
    id: "icon:check",
    name: "check",
    svg: "<svg/>",
    source: "check.svg",
  });
  const icon = f.own("icon:icon:check", "icon", "Icons");
  const example = {
    id: "examples/dashboard",
    name: "Example / Dashboard",
    root: { id: "root", kind: "frame" as const, name: "Dashboard" },
    documentation: {
      purpose: "Dashboard",
      usage: "Duplicate and compose real instances.",
      properties: "Native controls",
      origin: "Authored fixture",
    },
  };
  f.bundle.examples!.push(example);
  const screen = f.own(
    "example:" + example.id,
    "example",
    "Examples",
    1200,
    800,
  );
  const first = await organizeSections(
    f.api,
    f.bundle,
    f.index,
    f.save,
    f.metadata,
  );
  assert.equal(first.sections.length, 5);
  for (const [key, page] of [
    ["charts/BarChart", "Charts"],
    ["rte/Toolbar", "Rich text"],
    ["patterns/NavigationShell", "Product patterns"],
    ["icons", "Icons"],
    ["examples/dashboard", "Examples"],
  ]) {
    assert.equal(
      f.nodes.get(f.index.sections![key]).parent.id,
      f.page(page).id,
    );
  }
  assert.equal(icon.parent.id, f.index.sections!.icons);
  const captionId = f.index.sectionGuides!["examples/dashboard"],
    caption = f.nodes.get(captionId);
  assert.match(caption.characters, /Duplicate and compose real instances/);
  assert.equal(caption.y, screen.y);
  assert.ok(caption.x > screen.x + screen.width);
  await organizeSections(f.api, f.bundle, f.index, f.save, f.metadata);
  assert.equal(f.index.sectionGuides!["examples/dashboard"], captionId);
  assert.equal(f.stats().captionsCreated, 1);
  caption.characters = "My local note";
  const next = await organizeSections(
    f.api,
    f.bundle,
    f.index,
    f.save,
    f.metadata,
  );
  assert.equal(caption.characters, "My local note");
  assert.ok(next.warnings.some((w) => /locally edited/.test(w)));
});

test("strict native sections resize without constraints, pack variable bounds and never overlap", async () => {
  const f = fixture();
  f.recipe("components/A", "A", undefined, 16000, 1000);
  f.recipe("components/B", "B", undefined, 800, 600);
  f.recipe("components/C", "C", undefined, 1000, 1200);
  const result = await organizeSections(
    f.api,
    f.bundle,
    f.index,
    f.save,
    f.metadata,
  );
  const sections = result.sections.map((item) => f.nodes.get(item.id));
  for (let i = 0; i < sections.length; i++)
    for (let j = i + 1; j < sections.length; j++) {
      const a = sections[i],
        b = sections[j];
      assert.ok(
        a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y,
      );
    }
  for (const section of sections)
    for (const child of section.children)
      assert.ok(
        child.x + child.width <= section.width &&
          child.y + child.height <= section.height,
      );
});

test("section ownership/type preflight rejects bad ledger before changing any asset", async () => {
  const f = fixture(),
    set = f.recipe("components/Button", "Button");
  f.index.sections = { "components/Button": set.guide.id };
  const before = f.stats().sectionsCreated,
    originalParent = set.asset.parent.id;
  await assert.rejects(
    organizeSections(f.api, f.bundle, f.index, f.save, f.metadata),
    /section identity changed/,
  );
  assert.equal(f.stats().sectionsCreated, before);
  assert.equal(set.asset.parent.id, originalParent);
});

test("new section identity is saved immediately and safely reused after interruption", async () => {
  const f = fixture();
  f.recipe("components/Button", "Button");
  let interrupt = true;
  const save = () => {
    assert.ok(f.index.sections?.["components/Button"]);
    if (interrupt) {
      interrupt = false;
      throw Error("Simulated interruption");
    }
  };
  await assert.rejects(
    organizeSections(f.api, f.bundle, f.index, save, f.metadata),
    /Simulated interruption/,
  );
  const id = f.index.sections!["components/Button"];
  assert.ok(f.nodes.has(id));
  await organizeSections(f.api, f.bundle, f.index, f.save, f.metadata);
  assert.equal(f.index.sections!["components/Button"], id);
  assert.equal(f.stats().sectionsCreated, 1);
});

test("native section backgrounds and new captions bind existing semantic colors", async () => {
  const f = fixture();
  f.recipe("components/Button", "Button");
  f.bundle.examples!.push({
    id: "examples/guide",
    name: "Example / Guide",
    root: { id: "root", kind: "frame", name: "Guide" },
    documentation: { usage: "Source-backed usage." },
  });
  f.own("example:examples/guide", "example", "Examples");
  const surface = { id: "surface-variable", resolvedType: "COLOR" },
    text = { id: "text-variable", resolvedType: "COLOR" };
  f.index.assets["token:color-surface-default"] = {
    id: surface.id,
    kind: "token",
  };
  f.index.assets["token:color-primary-default"] = {
    id: text.id,
    kind: "token",
  };
  f.api.variables = {
    getVariableByIdAsync: async (id: string) =>
      id === surface.id ? surface : id === text.id ? text : null,
    setBoundVariableForPaint: (paint: any, field: string, variable: any) => ({
      ...paint,
      boundVariables: { [field]: { type: "VARIABLE_ALIAS", id: variable.id } },
    }),
  };
  await organizeSections(f.api, f.bundle, f.index, f.save, f.metadata);
  for (const id of Object.values(f.index.sections!))
    assert.equal(f.nodes.get(id).fills[0].boundVariables.color.id, surface.id);
  const caption = f.nodes.get(f.index.sectionGuides!["examples/guide"]);
  assert.equal(caption.fills[0].boundVariables.color.id, text.id);
});
