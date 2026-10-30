import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { SyncEngine } from "../src/engine";
import { read as readMetadata, write as writeMetadata } from "../src/metadata";
import type { Bundle } from "../src/schema";
function fixture(): Bundle {
  return {
    schemaVersion: 1,
    release: "test.1",
    fingerprint: "test-fingerprint",
    provenance: {},
    tokens: [
      {
        id: "primitive",
        name: "primitive",
        type: "COLOR",
        collection: "Primitives",
        values: { Value: { r: 1, g: 1, b: 1, a: 1 } },
        css: "var(--primitive)",
        scopes: [],
      },
      {
        id: "semantic",
        name: "semantic",
        type: "COLOR",
        collection: "Semantic",
        values: {
          Light: { alias: "primitive" },
          Dark: { r: 0, g: 0, b: 0, a: 1 },
        },
        css: "var(--semantic)",
        scopes: ["FRAME_FILL"],
      },
    ],
    styles: [],
    icons: [],
    recipes: [
      {
        id: "components:Test",
        name: "Test",
        package: "components",
        source: ["test.tsx"],
        status: "partial",
        limitations: [],
        variants: [
          {
            id: "default",
            props: { State: "Default" },
            root: {
              id: "root",
              name: "Test",
              kind: "frame",
              layout: "HORIZONTAL",
              gap: 8,
              padding: 12,
              bindings: { fills: "semantic" },
              children: [
                {
                  id: "label",
                  kind: "text",
                  name: "Label",
                  text: "Original",
                  fontSize: 14,
                },
              ],
            },
          },
          {
            id: "disabled",
            props: { State: "Disabled" },
            root: {
              id: "root",
              name: "Test",
              kind: "frame",
              children: [
                { id: "label", kind: "text", name: "Label", text: "Disabled" },
              ],
            },
          },
        ],
      },
    ],
    inventory: [],
    gaps: [],
  };
}
function mockApi() {
  let seq = 0;
  const nodes = new Map<string, any>(),
    collections = new Map<string, any>(),
    loadedFonts = new Set<string>();
  const metadataStats = {
    writes: 0,
    totalBytes: 0,
    maxWriteBytes: 0,
    maxWriteKey: "",
    maxValueBytes: 0,
    rootMaxWriteBytes: 0,
    rootWrites: 0,
    rootTotalBytes: 0,
  };
  function base(type: string) {
    const data = new Map<string, string>();
    const obj: any = {
      id: `${++seq}`,
      type,
      name: "",
      width: 100,
      height: 40,
      x: 0,
      y: 0,
      visible: true,
      opacity: 1,
      fills: [],
      strokes: [],
      boundVariables: {},
      getSharedPluginData: (ns: string, k: string) =>
        data.get(ns + ":" + k) ?? "",
      getSharedPluginDataKeys: (ns: string) =>
        [...data.keys()]
          .filter((key) => key.startsWith(ns + ":"))
          .map((key) => key.slice(ns.length + 1)),
      setSharedPluginData: (ns: string, k: string, v: string) => {
        const bytes = Buffer.byteLength(ns + k + v, "utf8");
        if (bytes > 100000)
          throw Error(
            `setSharedPluginData exceeds native 100000-byte namespace + key + value limit: ${bytes}`,
          );
        metadataStats.writes++;
        metadataStats.totalBytes += bytes;
        if (type === "DOCUMENT") {
          metadataStats.rootWrites++;
          metadataStats.rootTotalBytes += bytes;
          metadataStats.rootMaxWriteBytes = Math.max(
            metadataStats.rootMaxWriteBytes,
            bytes,
          );
        }
        metadataStats.maxValueBytes = Math.max(
          metadataStats.maxValueBytes,
          Buffer.byteLength(v, "utf8"),
        );
        if (bytes > metadataStats.maxWriteBytes) {
          metadataStats.maxWriteBytes = bytes;
          metadataStats.maxWriteKey = ns + ":" + k.split("__fs_")[0];
        }
        if (v === "") data.delete(ns + ":" + k);
        else data.set(ns + ":" + k, v);
      },
      setBoundVariable(k: string, v: any) {
        if (v === null) delete this.boundVariables[k];
        else this.boundVariables[k] = { type: "VARIABLE_ALIAS", id: v.id };
      },
      resize(w: number, h: number) {
        this.width = w;
        this.height = h;
      },
    };
    if (
      [
        "FRAME",
        "RECTANGLE",
        "ELLIPSE",
        "TEXT",
        "COMPONENT",
        "COMPONENT_SET",
        "INSTANCE",
        "VECTOR",
      ].includes(type)
    )
      Object.defineProperty(obj, "relativeTransform", {
        get() {
          const angle = ((this.rotation ?? 0) * Math.PI) / 180;
          return [
            [Math.cos(angle), -Math.sin(angle), this.x],
            [Math.sin(angle), Math.cos(angle), this.y],
          ];
        },
      });
    obj.setEffectStyleIdAsync = async (id: string) => {
      obj.effectStyleId = id;
    };
    nodes.set(obj.id, obj);
    return obj;
  }
  function container(type: string) {
    const o = base(type);
    if (type === "COMPONENT")
      o.createInstance = () => {
        const n = container("INSTANCE");
        Object.defineProperty(n, "mainComponent", {
          get() {
            throw Error(
              "mainComponent is write-only with dynamic-page; use getMainComponentAsync()",
            );
          },
        });
        let main = o;
        const overrides: Record<string, any> = {};
        n.getMainComponentAsync = async () => main;
        Object.defineProperty(n, "componentProperties", {
          get() {
            return Object.fromEntries(
              Object.entries(
                main.parent?.componentPropertyDefinitions ??
                  main.componentPropertyDefinitions ??
                  {},
              ).map(([key, def]: any) => [
                key,
                { type: def.type, value: overrides[key] ?? def.defaultValue },
              ]),
            );
          },
        });
        n.setProperties = (values: Record<string, any>) => {
          for (const [key, value] of Object.entries(values)) {
            const def = n.componentProperties[key];
            if (!def) throw Error("Unknown component property " + key);
            if (def.type === "TEXT" && typeof value !== "string")
              throw Error("TEXT property value must be string");
            overrides[key] = value;
            const apply = (child: any) => {
              if (child.componentPropertyReferences?.characters === key)
                child.characters = value;
              for (const item of child.children ?? []) apply(item);
            };
            n.children.forEach(apply);
          }
        };
        const clone = (src: any): any => {
          const child = src.children ? container(src.type) : base(src.type);
          for (const key of [
            "name",
            "width",
            "height",
            "x",
            "y",
            "fills",
            "strokes",
            "boundVariables",
            "characters",
            "componentPropertyReferences",
            "fontName",
            "fontSize",
          ])
            child[key] = structuredClone(src[key]);
          for (const item of src.children ?? []) child.appendChild(clone(item));
          return child;
        };
        const copyMain = () => {
          n.children = [];
          for (const child of main.children) n.appendChild(clone(child));
        };
        n.swapComponent = (next: any) => {
          main = next;
          copyMain();
        };
        copyMain();
        return n;
      };
    o.children = [];
    o.appendChild = (n: any) => {
      if (n.parent) {
        const idx = n.parent.children.indexOf(n);
        if (idx !== -1) n.parent.children.splice(idx, 1);
      }
      o.children.push(n);
      n.parent = o;
    };
    o.insertChild = (index: number, n: any) => {
      o.appendChild(n);
      o.children.splice(o.children.indexOf(n), 1);
      o.children.splice(index, 0, n);
    };
    return o;
  }
  const root = container("DOCUMENT");
  const page = container("PAGE");
  root.appendChild(page);
  const api: any = {
    root,
    currentPage: page,
    getNodeByIdAsync: async (id: string) => nodes.get(id) ?? null,
    getStyleByIdAsync: async (id: string) => nodes.get(id) ?? null,
    createPage: () => {
      const n = container("PAGE");
      root.appendChild(n);
      return n;
    },
    createFrame: () => container("FRAME"),
    createRectangle: () => base("RECTANGLE"),
    createEllipse: () => base("ELLIPSE"),
    createText: () => {
      const n = base("TEXT");
      let characters = "";
      Object.defineProperty(n, "characters", {
        get: () => characters,
        set(value: string) {
          if (
            !n.fontName ||
            !loadedFonts.has(n.fontName.family + ":" + n.fontName.style)
          )
            throw Error("Font must load before characters mutation");
          characters = value;
        },
      });
      n.setTextStyleIdAsync = async (id: string) => {
        n.textStyleId = id;
      };
      n.setEffectStyleIdAsync = async (id: string) => {
        n.effectStyleId = id;
      };
      return n;
    },
    createNodeFromSvg: () => {
      const n = container("FRAME"),
        vector = base("VECTOR");
      vector.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
      vector.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
      n.appendChild(vector);
      return n;
    },
    createComponent: () => container("COMPONENT"),
    combineAsVariants: (list: any[], parent: any) => {
      const n = container("COMPONENT_SET");
      n.componentPropertyDefinitions = {};
      n.editComponentProperty = (key: string, props: any) => {
        Object.assign(n.componentPropertyDefinitions[key], props);
        return key;
      };
      n.addComponentProperty = (name: string, type: string, value: any) => {
        const key = name + "#" + ++seq;
        n.componentPropertyDefinitions[key] = { type, defaultValue: value };
        return key;
      };
      parent.appendChild(n);
      list.forEach((child) => n.appendChild(child));
      return n;
    },
    loadFontAsync: async (font: any) => {
      loadedFonts.add(font.family + ":" + font.style);
    },
    createTextStyle: () => base("TEXT"),
    createEffectStyle: () => base("EFFECT"),
    variables: {
      createVariableCollection: (name: string) => {
        const c: any = base("COLLECTION");
        c.name = name;
        c.defaultModeId = "mode-" + c.id;
        c.modes = [{ modeId: c.defaultModeId, name: "Mode 1" }];
        c.renameMode = (id: string, name: string) => {
          c.modes.find((m: any) => m.modeId === id).name = name;
        };
        c.addMode = (name: string) => {
          const id = "mode-" + ++seq;
          c.modes.push({ modeId: id, name });
          return id;
        };
        collections.set(c.id, c);
        return c;
      },
      getVariableCollectionByIdAsync: async (id: string) =>
        collections.get(id) ?? null,
      createVariable: (name: string, collection: any, type: string) => {
        const v = base("VARIABLE");
        v.name = name;
        v.variableCollectionId = collection.id;
        v.resolvedType = type;
        v.valuesByMode = {};
        v.setValueForMode = (id: string, value: any) =>
          (v.valuesByMode[id] = value);
        v.codeSyntax = {};
        v.setVariableCodeSyntax = (platform: string, value: string) =>
          (v.codeSyntax[platform] = value);
        return v;
      },
      getVariableByIdAsync: async (id: string) => nodes.get(id) ?? null,
      setBoundVariableForEffect: (effect: any, key: string, v: any) => ({
        ...effect,
        boundVariables: { [key]: { type: "VARIABLE_ALIAS", id: v.id } },
      }),
      createVariableAlias: (v: any) => ({ type: "VARIABLE_ALIAS", id: v.id }),
      setBoundVariableForPaint: (paint: any, field: string, v: any) => ({
        ...paint,
        boundVariables: { [field]: { type: "VARIABLE_ALIAS", id: v.id } },
      }),
    },
  };
  return { api: api as PluginAPI, nodes, collections, metadataStats };
}
test("engine creates native modes aliases variants bindings and text properties; repeat sync is idempotent", async () => {
  const { api, nodes, collections } = mockApi();
  const bundle = fixture();
  const engine = new SyncEngine(api, bundle);
  const first = await engine.sync();
  assert.deepEqual(first.errors, []);
  assert.equal(first.complete, true);
  assert.equal(collections.size, 2);
  const semantics = [...collections.values()].find((c) =>
    c.name.endsWith("Semantic"),
  );
  assert.deepEqual(
    semantics.modes.map((m: any) => m.name),
    ["Light", "Dark"],
  );
  const p = engine.index.assets["token:primitive"];
  const s = nodes.get(engine.index.assets["token:semantic"].id);
  assert.deepEqual(s.valuesByMode[semantics.modes[0].modeId], {
    type: "VARIABLE_ALIAS",
    id: p.id,
  });
  const set = nodes.get(engine.index.assets["recipe:components:Test"].id);
  assert.equal(set.type, "COMPONENT_SET");
  assert.equal(set.children.length, 2);
  assert.equal(set.children[0].layoutMode, "HORIZONTAL");
  assert.equal(set.children[0].fills[0].boundVariables.color.id, s.id);
  assert.equal(Object.keys(set.componentPropertyDefinitions).length, 1);
  assert.equal(set.children[0].children[0].characters, "Original");
  const ids = Object.values(engine.index.assets).map((v) => v.id);
  const count = nodes.size;
  const next = await new SyncEngine(api, bundle).sync();
  assert.equal(next.complete, true);
  assert.equal(next.counts.unchanged, 4);
  assert.equal(nodes.size, count);
  assert.deepEqual(
    Object.values(engine.index.assets).map((v) => v.id),
    ids,
  );
});
test("source text update patches the same main and child IDs", async () => {
  const { api, nodes } = mockApi();
  const bundle = fixture();
  const engine = new SyncEngine(api, bundle);
  await engine.sync();
  const set = nodes.get(engine.index.assets["recipe:components:Test"].id);
  const componentId = set.children[0].id,
    childId = set.children[0].children[0].id;
  const next = structuredClone(bundle);
  next.recipes[0].variants[0].root.children![0].text = "Updated";
  next.fingerprint = "next";
  const result = await new SyncEngine(api, next).sync();
  assert.deepEqual(result.errors, []);
  assert.equal(result.complete, true);
  assert.equal(set.children[0].id, componentId);
  assert.equal(set.children[0].children[0].id, childId);
  assert.equal(set.children[0].children[0].characters, "Updated");
});
test("local managed drift is preserved and blocks a source update", async () => {
  const { api, nodes } = mockApi();
  const bundle = fixture();
  const engine = new SyncEngine(api, bundle);
  await engine.sync();
  const set = nodes.get(engine.index.assets["recipe:components:Test"].id);
  set.children[0].children[0].characters = "Local override";
  const next = structuredClone(bundle);
  next.recipes[0].variants[0].root.children![0].text = "Source update";
  const result = await new SyncEngine(api, next).sync();
  assert.equal(result.counts.conflict, 1);
  assert.equal(result.complete, false);
  assert.equal(set.children[0].children[0].characters, "Local override");
});
test("missing managed assets do not create duplicate replacement identities", async () => {
  const { api, nodes } = mockApi();
  const bundle = fixture();
  const engine = new SyncEngine(api, bundle);
  await engine.sync();
  const id = engine.index.assets["recipe:components:Test"].id;
  nodes.delete(id);
  const count = nodes.size;
  const result = await new SyncEngine(api, bundle).sync();
  assert.equal(result.counts.missing, 1);
  assert.equal(result.complete, false);
  assert.equal(nodes.size, count);
  assert.equal(engine.index.assets["recipe:components:Test"].id, id);
});
test("removed upstream assets remain for published instance migrations", async () => {
  const { api, nodes } = mockApi();
  const bundle = fixture();
  const engine = new SyncEngine(api, bundle);
  await engine.sync();
  const id = engine.index.assets["recipe:components:Test"].id;
  const next = structuredClone(bundle);
  next.recipes = [];
  const result = await new SyncEngine(api, next).sync();
  assert.equal(result.counts.retained, 2);
  assert.equal(result.complete, false);
  assert.ok(nodes.has(id));
});

import releaseBundle from "../bundles/fondue-13.11.1.json";
test("entire released bundle applies through native API model and repeats without duplicate assets", async () => {
  const { api, nodes, metadataStats } = mockApi();
  const engine = new SyncEngine(api, releaseBundle as unknown as Bundle);
  const first = await engine.sync();
  assert.deepEqual(first.errors, []);
  assert.equal(first.complete, true);
  const count = nodes.size;
  const importStats = { ...metadataStats };
  const rootIndexBytes = Buffer.byteLength(
    managedData(api.root, "index"),
    "utf8",
  );
  const assembledIndexBytes = Buffer.byteLength(
    JSON.stringify(engine.index),
    "utf8",
  );
  const shardBytes = Array.from({ length: 16 }, (_, i) =>
    Buffer.byteLength(managedData(api.root, "index_assets_" + i), "utf8"),
  );
  const appliedSizes = Object.values(engine.index.assets).map((ref) => ({
    id: ref.id,
    bytes: Buffer.byteLength(managedData(nodes.get(ref.id), "applied"), "utf8"),
  }));
  const largest = appliedSizes.reduce((a, b) => (a.bytes > b.bytes ? a : b));
  const again = await new SyncEngine(
    api,
    releaseBundle as unknown as Bundle,
  ).sync();
  assert.ok(metadataStats.maxWriteBytes <= 100000);
  assert.ok(
    rootIndexBytes > 0,
    "Full release root index must remain reconstructable.",
  );
  assert.ok(
    largest.bytes > 100000,
    "Full release applied snapshot should exercise records larger than one native metadata entry.",
  );
  const capacity = {
    release: releaseBundle.release,
    bundleFingerprint: releaseBundle.fingerprint,
    nativeLimitBytes: 100000,
    measurement:
      "UTF-8 bytes of namespace + key + value per setSharedPluginData call; enforced by native API model.",
    assets: Object.keys(engine.index.assets).length,
    nativeOpticalIconVariants: Object.values(engine.index.assets)
      .filter((ref) => ref.kind === "icon")
      .reduce(
        (n, ref) =>
          n +
          (nodes.get(ref.id)?.type === "COMPONENT_SET"
            ? nodes.get(ref.id).children.length
            : 1),
        0,
      ),
    sceneAndMetadataObjects: nodes.size,
    logicalRecords: {
      rootIndexBytes,
      assembledIndexBytes,
      maxIndexShardBytes: Math.max(...shardBytes),
      largestAppliedBytes: largest.bytes,
      maxLogicalRecordBytes: Math.max(rootIndexBytes, largest.bytes),
    },
    import: importStats,
    repeat: {
      writes: metadataStats.writes - importStats.writes,
      totalBytes: metadataStats.totalBytes - importStats.totalBytes,
    },
    maximumWriteBytes: metadataStats.maxWriteBytes,
  };
  fs.writeFileSync(
    new URL("../docs/metadata-capacity.json", import.meta.url),
    JSON.stringify(capacity, null, 2) + "\n",
  );
  console.log(
    "Metadata capacity " +
      JSON.stringify({
        assets: capacity.assets,
        maxWriteBytes: capacity.maximumWriteBytes,
        rootIndexBytes,
        largestAppliedBytes: largest.bytes,
        importWrites: importStats.writes,
        repeatWrites: capacity.repeat.writes,
      }),
  );
  assert.deepEqual(again.errors, []);
  assert.equal(again.complete, true);
  assert.equal(nodes.size, count);
  assert.equal(
    capacity.repeat.writes,
    0,
    "Idempotent import must not rewrite unchanged metadata.",
  );
  const recipe = releaseBundle.recipes.find(
    (r) => r.documentation?.origin === "released-metadata",
  )!;
  const set = nodes.get(engine.index.assets["recipe:" + recipe.id].id);
  assert.equal(set.description, recipe.documentation.description);
  assert.ok(set.documentationLinks[0].uri.includes("ebcc9b85"));
  assert.equal(set.children[0].description, set.description);
  assert.ok(engine.index.assets["guide:" + recipe.id]);
});
test("native usage documentation changes update in place and local edits are protected", async () => {
  const { api, nodes } = mockApi();
  const bundle = fixture();
  bundle.recipes[0].documentation = {
    purpose: "Choose an action",
    usage: "Use for actions",
    properties: "State: Default, Disabled",
    description: "Purpose and usage",
    origin: "editorial",
    metadataSource: null,
    links: [{ uri: "https://example.com/docs" }],
  };
  const engine = new SyncEngine(api, bundle);
  await engine.sync();
  const setId = engine.index.assets["recipe:components:Test"].id;
  const guideId = engine.index.assets["guide:components:Test"].id;
  const next = structuredClone(bundle);
  next.recipes[0].documentation!.description = "Updated guidance";
  const result = await new SyncEngine(api, next).sync();
  assert.equal(result.complete, true);
  assert.equal(nodes.get(setId).description, "Updated guidance");
  assert.equal(engine.index.assets["guide:components:Test"].id, guideId);
  nodes.get(setId).description = "Local guidance";
  const blocked = await new SyncEngine(api, next).sync();
  assert.equal(blocked.counts.conflict, 1);
  assert.equal(nodes.get(setId).description, "Local guidance");
});
test("structural removal requires migration and leaves existing layers intact", async () => {
  const { api, nodes } = mockApi();
  const bundle = fixture();
  const engine = new SyncEngine(api, bundle);
  await engine.sync();
  const set = nodes.get(engine.index.assets["recipe:components:Test"].id);
  const next = structuredClone(bundle);
  next.recipes[0].variants[0].root.children = [];
  const result = await new SyncEngine(api, next).sync();
  assert.equal(result.complete, false);
  assert.match(
    result.actions.find((a) => a.action === "conflict")!.reason!,
    /migration/,
  );
  assert.equal(set.children[0].children[0].characters, "Original");
});
test("dynamic-page instances use async main component lookup, clone icon vectors and bind overrides without recoloring the main", async () => {
  const { api, nodes } = mockApi();
  const bundle = fixture();
  bundle.icons = [
    {
      id: "icon:check-mark",
      name: "check-mark",
      source: "check.svg",
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M2 8h12"/></svg>',
    },
  ];
  bundle.recipes[0].variants[0].root.children!.push({
    id: "icon",
    name: "Icon",
    kind: "instance",
    iconId: "icon:check-mark",
    iconColor: "semantic",
    width: 16,
    height: 16,
  });
  const engine = new SyncEngine(api, bundle);
  const result = await engine.sync();
  assert.deepEqual(result.errors, []);
  assert.equal(result.complete, true);
  const set = nodes.get(engine.index.assets["recipe:components:Test"].id),
    instance = set.children[0].children.find((n: any) => n.type === "INSTANCE");
  assert.ok(instance);
  assert.equal(
    (await instance.getMainComponentAsync()).id,
    engine.index.assets["icon:icon:check-mark"].id,
  );
  assert.throws(() => instance.mainComponent, /dynamic-page/);
  assert.equal(
    instance.children[0].children[0].fills[0].boundVariables.color.id,
    engine.index.assets["token:semantic"].id,
  );
  const main = nodes.get(engine.index.assets["icon:icon:check-mark"].id);
  assert.equal(main.children[0].children[0].fills[0].boundVariables, undefined);
  assert.ok(
    Object.values(set.componentPropertyDefinitions).some(
      (p: any) => p.type === "INSTANCE_SWAP",
    ),
  );
  assert.ok(
    Object.values(set.componentPropertyDefinitions).some(
      (p: any) => p.type === "BOOLEAN",
    ),
  );
});
test("page arrangements leave normalized root transform baseline unchanged", async () => {
  const { api, nodes } = mockApi();
  const bundle = fixture();
  bundle.recipes.push({
    ...structuredClone(bundle.recipes[0]),
    id: "components:Second",
    name: "Second",
  });
  const engine = new SyncEngine(api, bundle);
  const first = await engine.sync();
  assert.equal(first.complete, true);
  const set = nodes.get(engine.index.assets["recipe:components:Second"].id);
  assert.ok(set.x > 0);
  assert.equal(set.relativeTransform[0][2], set.x);
  assert.equal((await new SyncEngine(api, bundle).sync()).complete, true);
});
test("source migration preflight blocks unrelated token updates and new shells", async () => {
  const { api, nodes } = mockApi();
  const bundle = fixture();
  const engine = new SyncEngine(api, bundle);
  await engine.sync();
  const oldColor = structuredClone(
      nodes.get(engine.index.assets["token:primitive"].id).valuesByMode,
    ),
    count = nodes.size;
  const next = structuredClone(bundle);
  next.tokens[0].values.Value = { r: 1, g: 0, b: 0, a: 1 };
  next.tokens.push({
    id: "new",
    name: "new",
    type: "FLOAT",
    collection: "Primitives",
    values: { Value: 8 },
    css: "var(--new)",
  });
  next.recipes[0].variants[0].root.children = [];
  const result = await new SyncEngine(api, next).sync();
  assert.equal(result.complete, false);
  assert.equal(nodes.size, count);
  assert.deepEqual(
    nodes.get(engine.index.assets["token:primitive"].id).valuesByMode,
    oldColor,
  );
  assert.equal(new SyncEngine(api, next).index.assets["token:new"], undefined);
});
test("example frames consume native main components, expose real property defaults and update text overrides in place", async () => {
  const { api, nodes } = mockApi();
  const bundle = fixture();
  bundle.examples = [
    {
      id: "example:test",
      name: "A composed example",
      bindings: { title: "record.title" },
      root: {
        id: "example",
        name: "Example",
        kind: "frame",
        layout: "VERTICAL",
        children: [
          {
            id: "action",
            name: "Action",
            kind: "componentInstance",
            componentName: "Test",
            variantProps: { State: "Default" },
            text: "From example",
          },
        ],
      },
    },
  ] as any;
  const engine = new SyncEngine(api, bundle);
  const first = await engine.sync();
  assert.deepEqual(first.errors, []);
  assert.equal(first.complete, true);
  const example = nodes.get(engine.index.assets["example:example:test"].id),
    instance = example.children[0],
    main = await instance.getMainComponentAsync();
  assert.equal(instance.type, "INSTANCE");
  assert.equal(instance.children[0].characters, "From example");
  assert.equal(main.children[0].characters, "Original");
  assert.ok(JSON.parse(managedData(instance, "component-binding")).recipeId);
  assert.equal(
    JSON.parse(managedData(example, "example-binding")).bindings.title,
    "record.title",
  );
  const next = structuredClone(bundle);
  next.examples![0].root.children![0].text = "Changed override";
  const result = await new SyncEngine(api, next).sync();
  assert.deepEqual(result.errors, []);
  assert.equal(result.complete, true);
  assert.equal(example.children[0].id, instance.id);
  assert.equal(instance.children[0].characters, "Changed override");
  assert.equal(main.children[0].characters, "Original");
  const again = await new SyncEngine(api, next).sync();
  assert.equal(again.complete, true);
});
function managedData(node: any, key: string) {
  return readMetadata(node, key);
}

test("an interrupted initial SVG import resumes the same managed icon shell without duplicating vectors", async () => {
  const { api, nodes } = mockApi();
  const bundle = fixture();
  bundle.icons = [
    { id: "icon:sample", name: "sample", svg: "<svg/>", source: "sample.svg" },
  ];
  const create = (api as any).createNodeFromSvg;
  let first = true;
  (api as any).createNodeFromSvg = () => {
    if (first) {
      first = false;
      throw Error("Simulated SVG failure");
    }
    return create();
  };
  const initial = new SyncEngine(api, bundle);
  const failed = await initial.sync();
  assert.equal(failed.complete, false);
  assert.ok(failed.errors.some((e) => e.includes("Simulated SVG failure")));
  const id = initial.index.assets["icon:icon:sample"].id;
  assert.equal(nodes.get(id).children.length, 0);
  const resume = new SyncEngine(api, bundle);
  const plan = await resume.inspect();
  assert.equal(
    plan.actions.find((a) => a.id === "icon:icon:sample")?.action,
    "update",
  );
  const applied = await resume.sync();
  assert.deepEqual(applied.errors, []);
  assert.equal(applied.complete, true);
  assert.equal(resume.index.assets["icon:icon:sample"].id, id);
  assert.equal(nodes.get(id).children.length, 1);
  const count = nodes.size;
  assert.equal((await new SyncEngine(api, bundle).sync()).complete, true);
  assert.equal(nodes.size, count);
});
test("compatible source field removal clears data bindings, strokes, native aliases and effects in place", async () => {
  const { api, nodes } = mockApi();
  const bundle = fixture();
  bundle.tokens.push({
    id: "gap",
    name: "gap",
    type: "FLOAT",
    collection: "Primitives",
    values: { Value: 8 },
    css: "8px",
    scopes: ["GAP"],
  });
  const root = bundle.recipes[0].variants[0].root;
  root.dataBinding = { schemaVersion: 1, domain: "assets", field: "name" };
  root.stroke = "#FF0000";
  root.bindings = { ...root.bindings, strokes: "semantic", itemSpacing: "gap" };
  root.effects = [
    {
      type: "DROP_SHADOW",
      color: { r: 0, g: 0, b: 0, a: 0.2 },
      offset: { x: 0, y: 2 },
      radius: 4,
      visible: true,
      blendMode: "NORMAL",
    },
  ];
  root.opacity = 0.5;
  root.radius = 8;
  const initial = new SyncEngine(api, bundle);
  assert.deepEqual((await initial.sync()).errors, []);
  const set = nodes.get(initial.index.assets["recipe:components:Test"].id),
    component = set.children[0];
  const id = component.id;
  assert.ok(managedData(component, "data-binding"));
  assert.ok(component.strokes.length);
  assert.ok(component.boundVariables.itemSpacing);
  assert.ok(component.effects.length);
  const next = structuredClone(bundle);
  const target = next.recipes[0].variants[0].root;
  delete target.dataBinding;
  delete target.stroke;
  target.bindings = {};
  delete target.effects;
  delete target.opacity;
  delete target.radius;
  const result = await new SyncEngine(api, next).sync();
  assert.deepEqual(result.errors, []);
  assert.equal(result.complete, true);
  assert.equal(set.children[0].id, id);
  assert.equal(managedData(component, "data-binding"), "");
  assert.deepEqual(component.strokes, []);
  assert.deepEqual(component.fills, []);
  assert.ok(!component.boundVariables.itemSpacing);
  assert.deepEqual(component.effects, []);
  assert.equal(component.opacity, 1);
  assert.equal(component.cornerRadius, 0);
  assert.equal((await new SyncEngine(api, next).inspect()).counts.unchanged, 5);
});
test("source style removal clears native text/effect style links while retaining style and layer identities", async () => {
  const { api, nodes } = mockApi();
  const bundle = fixture();
  bundle.styles = [
    {
      id: "text",
      name: "text",
      type: "TEXT",
      fontFamily: "Inter",
      fontStyle: "Regular",
      fontSize: 14,
      lineHeight: 18,
      letterSpacing: 0,
    },
    { id: "effect", name: "effect", type: "EFFECT", effects: [] },
  ];
  const root = bundle.recipes[0].variants[0].root;
  root.effectStyle = "effect";
  root.children![0].textStyle = "text";
  const initial = new SyncEngine(api, bundle);
  assert.deepEqual((await initial.sync()).errors, []);
  const component = nodes.get(initial.index.assets["recipe:components:Test"].id)
      .children[0],
    child = component.children[0];
  assert.ok(component.effectStyleId);
  assert.ok(child.textStyleId);
  const next = structuredClone(bundle);
  delete next.recipes[0].variants[0].root.effectStyle;
  delete next.recipes[0].variants[0].root.children![0].textStyle;
  const applied = await new SyncEngine(api, next).sync();
  assert.deepEqual(applied.errors, []);
  assert.equal(applied.complete, true);
  assert.equal(component.effectStyleId, "");
  assert.equal(child.textStyleId, "");
  assert.equal(
    nodes.get(initial.index.assets["recipe:components:Test"].id).children[0]
      .children[0].id,
    child.id,
  );
});
test("source text updates exposed defaults for new instances and local default edits block update", async () => {
  const { api, nodes } = mockApi();
  const bundle = fixture();
  const initial = new SyncEngine(api, bundle);
  await initial.sync();
  const set = nodes.get(initial.index.assets["recipe:components:Test"].id);
  const key = Object.keys(set.componentPropertyDefinitions).find(
    (k) => set.componentPropertyDefinitions[k].type === "TEXT",
  )!;
  assert.equal(set.componentPropertyDefinitions[key].defaultValue, "Original");
  const oldInstance = set.children[0].createInstance();
  oldInstance.setProperties({ [key]: "Consumer override" });
  const next = structuredClone(bundle);
  next.recipes[0].variants[0].root.children![0].text = "New source default";
  const applied = await new SyncEngine(api, next).sync();
  assert.deepEqual(applied.errors, []);
  assert.equal(applied.complete, true);
  const fresh = set.children[0].createInstance();
  assert.equal(fresh.componentProperties[key].value, "New source default");
  assert.equal(oldInstance.componentProperties[key].value, "Consumer override");
  assert.equal(
    set.componentPropertyDefinitions[key].defaultValue,
    "New source default",
  );
  set.editComponentProperty(key, { defaultValue: "Local default" });
  const plan = await new SyncEngine(api, next).inspect();
  assert.equal(
    plan.actions.find((a) => a.id === "recipe:components:Test")?.action,
    "conflict",
  );
  const stopped = await new SyncEngine(api, next).sync();
  assert.equal(stopped.complete, false);
  assert.equal(
    set.componentPropertyDefinitions[key].defaultValue,
    "Local default",
  );
});

test("specialized source field removal resets text decoration, stroke weight and arc geometry", async () => {
  const { api, nodes } = mockApi();
  const bundle = fixture();
  const root = bundle.recipes[0].variants[0].root;
  root.children![0].textDecoration = "UNDERLINE";
  root.children!.push({
    id: "ring",
    kind: "ellipse",
    name: "Ring",
    width: 20,
    height: 20,
    strokeWeight: 4,
    arcData: { startingAngle: 0, endingAngle: Math.PI, innerRadius: 0.5 },
  });
  const engine = new SyncEngine(api, bundle);
  await engine.sync();
  const set = nodes.get(engine.index.assets["recipe:components:Test"].id);
  const ring = set.children[0].children[1];
  const next = structuredClone(bundle);
  delete next.recipes[0].variants[0].root.children![0].textDecoration;
  delete next.recipes[0].variants[0].root.children![1].strokeWeight;
  delete next.recipes[0].variants[0].root.children![1].arcData;
  const report = await new SyncEngine(api, next).sync();
  assert.equal(report.complete, true);
  assert.equal(set.children[0].children[0].textDecoration, "NONE");
  assert.equal(ring.strokeWeight, 1);
  assert.deepEqual(ring.arcData, {
    startingAngle: 0,
    endingAngle: Math.PI * 2,
    innerRadius: 0,
  });
});

test("required mode capacity is checked before creating variables and pending foundations can resume", async () => {
  const { api, collections } = mockApi();
  const create = api.variables.createVariableCollection.bind(api.variables);
  let fail = true;
  api.variables.createVariableCollection = (name: string) => {
    const result = create(name);
    if (name.endsWith("Semantic")) {
      const add = result.addMode.bind(result);
      result.addMode = (mode: string) => {
        if (fail) {
          fail = false;
          throw Error("mode capacity temporarily unavailable");
        }
        return add(mode);
      };
    }
    return result;
  };
  const bundle = fixture();
  const firstEngine = new SyncEngine(api, bundle);
  const first = await firstEngine.sync();
  assert.equal(first.complete, false);
  assert.match(first.errors[0], /required Light\/Dark/);
  assert.equal(Object.keys(firstEngine.index.assets).length, 0);
  const resumed = await new SyncEngine(api, bundle).sync();
  assert.equal(resumed.complete, true);
  assert.equal(collections.size, 2);
});

test("native icon slots use the exact optical source component and preserve instance identity when size changes", async () => {
  const { api, nodes } = mockApi();
  const bundle = fixture();
  bundle.icons = [
    {
      id: "icon:optical",
      name: "Optical",
      svg: '<svg width="24" height="24"/>',
      source: "24.svg",
      sizes: [
        { size: 16, svg: '<svg width="16" height="16"/>', source: "16.svg" },
        { size: 24, svg: '<svg width="24" height="24"/>', source: "24.svg" },
      ],
    },
  ];
  bundle.recipes[0].variants[0].root.children!.push({
    id: "optical",
    kind: "instance",
    name: "Optical",
    iconId: "icon:optical",
    width: 16,
    height: 16,
  });
  const engine = new SyncEngine(api, bundle);
  const first = await engine.sync();
  assert.equal(first.complete, true);
  const set = nodes.get(engine.index.assets["icon:icon:optical"].id);
  assert.equal(set.type, "COMPONENT_SET");
  assert.equal(set.children.length, 2);
  const host = nodes.get(engine.index.assets["recipe:components:Test"].id);
  const instance = host.children[0].children[1];
  const id = instance.id;
  assert.equal((await instance.getMainComponentAsync()).name, "Size=16");
  const next = structuredClone(bundle);
  next.recipes[0].variants[0].root.children![1].width = 24;
  next.recipes[0].variants[0].root.children![1].height = 24;
  const report = await new SyncEngine(api, next).sync();
  assert.equal(report.complete, true);
  assert.equal(instance.id, id);
  assert.equal((await instance.getMainComponentAsync()).name, "Size=24");
});
test("metadata model enforces native UTF-8 capacity including namespace and key overhead", () => {
  const { api, metadataStats } = mockApi();
  const ns = "fondue_sync",
    key = "capacity";
  const overhead = Buffer.byteLength(ns + key, "utf8");
  api.root.setSharedPluginData(ns, key, "x".repeat(100000 - overhead));
  assert.equal(metadataStats.maxWriteBytes, 100000);
  assert.throws(
    () => api.root.setSharedPluginData(ns, key, "x".repeat(100001 - overhead)),
    /100000-byte/,
  );
  assert.throws(
    () => api.root.setSharedPluginData(ns, key, "😀".repeat(25000)),
    /100000-byte/,
  );
});
test("large root indexes and unabridged non-ASCII applied snapshots round-trip through byte-limited atomic metadata entries", () => {
  const { api, metadataStats } = mockApi();
  const index = JSON.stringify({
    schema: 1,
    assets: Object.fromEntries(
      Array.from({ length: 4000 }, (_, i) => [
        `recipe:components/Published-${i}`,
        { id: `native:${i}`, kind: "recipe" },
      ]),
    ),
  });
  const snapshot = JSON.stringify({
    children: Array.from({ length: 1200 }, (_, i) => ({
      id: `native:${i}`,
      characters: "完整组件 🎨 / native editable content / Ελληνικά",
      fills: [{ type: "SOLID", color: { r: 0.25, g: 0.5, b: 0.75 } }],
      boundVariables: { fontSize: { type: "VARIABLE_ALIAS", id: "font-size" } },
    })),
  });
  const applied = JSON.stringify({
    nodeId: "native:large",
    definition: JSON.stringify({ source: "pinned-release" }),
    snapshot,
  });
  assert.ok(Buffer.byteLength(index, "utf8") > 100000);
  assert.ok(Buffer.byteLength(applied, "utf8") > 100000);
  writeMetadata(api.root, "index", index);
  writeMetadata(api.root, "applied", applied);
  assert.equal(readMetadata(api.root, "index"), index);
  assert.equal(readMetadata(api.root, "applied"), applied);
  assert.equal(
    JSON.parse(readMetadata(api.root, "applied")).snapshot,
    snapshot,
  );
  assert.ok(metadataStats.maxWriteBytes <= 100000);
  assert.ok(metadataStats.maxValueBytes <= 24000);
  const head = JSON.parse(
    api.root.getSharedPluginData("fondue_sync", "applied__fs_head"),
  );
  assert.ok(head.parts > 1);
  assert.equal(head.bytes, Buffer.byteLength(applied, "utf8"));
});

test("sharded indexes reopen without rewriting unchanged metadata and legacy flat ledgers migrate before allocations", async () => {
  const { api, nodes, metadataStats } = mockApi();
  const bundle = fixture();
  const first = new SyncEngine(api, bundle);
  await first.sync();
  const count = nodes.size;
  const header = JSON.parse(managedData(api.root, "index"));
  assert.equal(header.schema, 2);
  assert.equal(header.assetShards, 16);
  assert.equal(header.assets, undefined);
  const previousWrites = metadataStats.writes;
  const reopened = new SyncEngine(api, bundle);
  await reopened.sync();
  assert.equal(metadataStats.writes, previousWrites);
  assert.deepEqual(reopened.index.assets, first.index.assets);
  const flat = { ...first.index, schema: 1, assetShards: undefined };
  writeMetadata(api.root, "index", JSON.stringify(flat));
  const legacy = new SyncEngine(api, bundle);
  const migrated = await legacy.sync();
  assert.equal(migrated.complete, true);
  assert.equal(JSON.parse(managedData(api.root, "index")).schema, 2);
  assert.equal(nodes.size, count);
  writeMetadata(api.root, "index_assets_0", "");
  assert.throws(
    () => new SyncEngine(api, bundle),
    /Missing managed index shard/,
  );
});
