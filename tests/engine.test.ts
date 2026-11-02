import {
  applyApprovedImageMigration,
  imageMigrationProblems,
  imageMigrationSourceHash,
} from "../src/image-migrations";
import { migrationProblems } from "../src/preflight";
import { imageSha256 } from "../src/images";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { SyncEngine } from "../src/engine";
import { snapshot } from "../src/snapshot";
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
function mockApi(simulateVariants = false) {
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
      remove() {
        if (this.parent?.children)
          this.parent.children.splice(this.parent.children.indexOf(this), 1);
        const erase = (node: any) => {
          for (const child of node.children ?? []) erase(child);
          nodes.delete(node.id);
          node.removed = true;
        };
        erase(this);
      },
      resize(w: number, h: number) {
        this.width = w;
        this.height = h;
      },
      resizeWithoutConstraints(w: number, h: number) {
        this.width = w;
        this.height = h;
      },
      setExplicitVariableModeForCollection(collection: any, modeId: string) {
        if (typeof collection === "string")
          throw Error("dynamic-page requires exact collection object");
        if (!collection.modes.some((mode: any) => mode.modeId === modeId))
          throw Error("Unknown native variable mode");
        this.explicitVariableModes ??= {};
        this.explicitVariableModes[collection.id] = modeId;
      },
      rescale(factor: number) {
        if (!Number.isFinite(factor) || factor <= 0)
          throw Error("Invalid native rescale factor");
        this.rescaleCalls ??= [];
        this.rescaleCalls.push(factor);
        if (this.type === "INSTANCE")
          this.scaleFactor = (this.scaleFactor ?? 1) * factor;
        const scale = (node: any, root = false) => {
          node.width *= factor;
          node.height *= factor;
          if (!root) {
            node.x *= factor;
            node.y *= factor;
          }
          if (typeof node.strokeWeight === "number")
            node.strokeWeight *= factor;
          for (const child of node.children ?? []) scale(child);
        };
        scale(this, true);
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
    if (type === "COMPONENT" || type === "COMPONENT_SET") {
      let documentationLinks: { uri: string }[] = [];
      Object.defineProperty(obj, "documentationLinks", {
        configurable: true,
        get: () => documentationLinks.map((link) => ({ ...link })),
        set(links: { uri: string }[]) {
          if (!Array.isArray(links) || links.length > 1)
            throw Error("Native documentationLinks accepts at most one link");
          for (const link of links)
            if (typeof link.uri !== "string")
              throw Error("documentationLinks requires uri");
          documentationLinks = links.map((link) => ({ ...link }));
        },
      });
    }
    if (["FRAME", "COMPONENT"].includes(type)) {
      let alignment = "MIN";
      Object.defineProperty(obj, "counterAxisAlignItems", {
        get: () => alignment,
        set(value: string) {
          if (obj.layoutMode === "VERTICAL" && value === "BASELINE")
            throw Error(
              "Native BASELINE counter-axis alignment is invalid for vertical Auto Layout",
            );
          alignment = value;
        },
      });
    }
    if (type === "ELLIPSE")
      Object.defineProperty(obj, "cornerRadius", {
        get: () => undefined,
        set() {
          throw Error("Native EllipseNode has no cornerRadius property");
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
    if (type === "COMPONENT") {
      o.createSlot = () => {
        const owner = o.parent?.type === "COMPONENT_SET" ? o.parent : o;
        const slot = container("SLOT");
        const key = owner.addComponentProperty("Slot", "SLOT", "");
        slot.componentPropertyReferences = { slotContentId: key };
        o.appendChild(slot);
        return slot;
      };
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
        n.__mockMain = main;
        n.scaleFactor = 1;
        const overrides: Record<string, any> = {};
        n.__mockPropertyOverrides = overrides;
        n.getMainComponentAsync = async () => main;
        const ownShared = n.getSharedPluginData,
          ownSharedKeys = n.getSharedPluginDataKeys;
        n.getSharedPluginData = (ns: string, key: string) =>
          ownShared(ns, key) || main.getSharedPluginData(ns, key);
        n.getSharedPluginDataKeys = (ns: string) => [
          ...new Set([
            ...ownSharedKeys(ns),
            ...main.getSharedPluginDataKeys(ns),
          ]),
        ];
        Object.defineProperty(n, "componentProperties", {
          get() {
            return Object.fromEntries(
              Object.entries(
                main.parent?.componentPropertyDefinitions ??
                  main.componentPropertyDefinitions ??
                  {},
              ).map(([key, def]: any) => [
                key,
                {
                  type: def.type,
                  value:
                    overrides[key] ??
                    (def.type === "VARIANT"
                      ? Object.fromEntries(
                          main.name
                            .split(",")
                            .map((part: string) => part.trim().split("=")),
                        )[key]
                      : undefined) ??
                    def.defaultValue,
                },
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
          const child =
            src.type === "INSTANCE" && src.__mockMain
              ? src.__mockMain.createInstance()
              : src.type === "TEXT"
                ? api.createText()
                : src.children
                  ? container(src.type)
                  : base(src.type);
          if (child.children) child.children = [];
          for (const key of [
            "name",
            "width",
            "height",
            "x",
            "y",
            "fills",
            "strokes",
            "boundVariables",
            "componentPropertyReferences",
            "fontName",
            "fontSize",
            "characters",
            "visible",
            "opacity",
            "layoutMode",
            "primaryAxisSizingMode",
            "counterAxisSizingMode",
            "paddingTop",
            "paddingRight",
            "paddingBottom",
            "paddingLeft",
            "itemSpacing",
          ])
            child[key] = structuredClone(src[key]);
          for (const key of src.getSharedPluginDataKeys("fondue_sync"))
            child.setSharedPluginData(
              "fondue_sync",
              key,
              src.getSharedPluginData("fondue_sync", key),
            );
          for (const item of src.children ?? []) child.appendChild(clone(item));
          if (src.__mockPropertyOverrides)
            child.setProperties(src.__mockPropertyOverrides);
          return child;
        };
        const copyMain = () => {
          n.children = [];
          n.width = main.width * n.scaleFactor;
          n.height = main.height * n.scaleFactor;
          for (const child of main.children) {
            const copy = clone(child);
            if (n.scaleFactor !== 1) copy.rescale(n.scaleFactor);
            n.appendChild(copy);
          }
        };
        n.swapComponent = (next: any) => {
          main = next;
          n.__mockMain = main;
          copyMain();
        };
        copyMain();
        return n;
      };
    }
    o.children = [];
    o.findAll = (predicate: (node: any) => boolean) => {
      const result: any[] = [];
      const visit = (node: any) => {
        for (const child of node.children ?? []) {
          if (predicate(child)) result.push(child);
          visit(child);
        }
      };
      visit(o);
      return result;
    };
    o.findAllWithCriteria = ({ types }: any) =>
      o.findAll((node: any) => types.includes(node.type));
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
    viewport: { scrollAndZoomIntoView: () => {} },
    setCurrentPageAsync: async (next: any) => {
      if (!next || next.type !== "PAGE")
        throw Error("Native current page must be PAGE");
      api.currentPage = next;
    },
    getNodeByIdAsync: async (id: string) => nodes.get(id) ?? null,
    getStyleByIdAsync: async (id: string) => nodes.get(id) ?? null,
    createPage: () => {
      const n = container("PAGE");
      root.appendChild(n);
      return n;
    },
    createFrame: () => container("FRAME"),
    createSection: () => {
      const n = container("SECTION");
      n.sectionContentsHidden = false;
      n.resizeWithoutConstraints = (width: number, height: number) => {
        if (
          !Number.isFinite(width) ||
          !Number.isFinite(height) ||
          width < 0.01 ||
          height < 0.01
        )
          throw Error("Native section bounds must be finite and >= 0.01");
        n.width = width;
        n.height = height;
      };
      n.resize = n.resizeWithoutConstraints;
      Object.defineProperty(n, "layoutMode", {
        set() {
          throw Error("Native sections do not support Auto Layout");
        },
      });
      api.currentPage.appendChild(n);
      return n;
    },

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
      n.getStyledTextSegments = () => [{ fontName: n.fontName }];
      n.setTextStyleIdAsync = async (id: string) => {
        n.textStyleId = id;
        if (id) {
          const style = nodes.get(id);
          if (!style || style.type !== "TEXT")
            throw Error("Missing native text style " + id);
          for (const field of [
            "fontName",
            "fontSize",
            "lineHeight",
            "letterSpacing",
            "textCase",
          ])
            if (style[field] !== undefined)
              n[field] = structuredClone(style[field]);
          n.boundVariables = {
            ...n.boundVariables,
            ...structuredClone(style.boundVariables ?? {}),
          };
        }
      };
      n.setEffectStyleIdAsync = async (id: string) => {
        n.effectStyleId = id;
      };
      return n;
    },
    createNodeFromSvg: (svg: string) => {
      const n = container("FRAME"),
        vector = base("VECTOR");
      vector.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
      vector.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
      const width = Number(svg.match(/\bwidth=["']([\d.]+)/)?.[1] ?? 24),
        height = Number(svg.match(/\bheight=["']([\d.]+)/)?.[1] ?? width);
      n.width = vector.width = width;
      n.height = vector.height = height;
      n.appendChild(vector);
      return n;
    },
    createComponent: () => container("COMPONENT"),
    combineAsVariants: (list: any[], parent: any) => {
      const n = container("COMPONENT_SET");
      const definitions: Record<string, any> = {};
      n.nativePropertyDefinitionReads = [];
      Object.defineProperty(n, "componentPropertyDefinitions", {
        get() {
          const names = n.children.map((child: any) => child.name);
          n.nativePropertyDefinitionReads.push(names);
          for (const name of names)
            for (const part of name.split(",")) {
              const index = part.indexOf("=");
              if (index < 1 || !part.slice(index + 1).trim())
                throw Error("Native invalid or empty variant value: " + name);
            }
          if (simulateVariants) {
            const inferred: any = {};
            for (const name of names)
              for (const part of name.split(",")) {
                const [key, value] = part.trim().split("=");
                if (key && value)
                  inferred[key] ??= { type: "VARIANT", defaultValue: value };
              }
            return { ...inferred, ...definitions };
          }
          return definitions;
        },
      });
      n.editComponentProperty = (key: string, props: any) => {
        Object.assign(n.componentPropertyDefinitions[key], props);
        if (props.name && props.name !== key.split("#")[0]) {
          const renamed = props.name + "#" + key.split("#")[1];
          definitions[renamed] = definitions[key];
          delete definitions[key];
          for (const node of nodes.values())
            for (const [field, value] of Object.entries(
              node.componentPropertyReferences ?? {},
            ))
              if (value === key)
                node.componentPropertyReferences[field] = renamed;
          return renamed;
        }
        return key;
      };
      n.deleteComponentProperty = (key: string) => {
        delete definitions[key];
      };
      n.addComponentProperty = (
        name: string,
        type: string,
        value: any,
        options = {},
      ) => {
        const key = name + "#" + ++seq;
        definitions[key] = {
          type,
          defaultValue: value,
          ...options,
        };
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
        v.resolveForConsumer = (node: any): any => {
          const c = collections.get(v.variableCollectionId);
          let mode = c.defaultModeId;
          for (let owner = node; owner; owner = owner.parent) {
            if (owner.explicitVariableModes?.[c.id]) {
              mode = owner.explicitVariableModes[c.id];
              break;
            }
          }
          const value = v.valuesByMode[mode];
          return value?.type === "VARIABLE_ALIAS"
            ? nodes.get(value.id).resolveForConsumer(node)
            : { resolvedType: v.resolvedType, value };
        };
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
  installImageApi(api as PluginAPI);
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
  assert.equal(Object.keys(set.componentPropertyDefinitions).length, 2);
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
test("category migration renames existing sets and preserves instances, variants and repeat sync", async () => {
  const { api, nodes } = mockApi();
  const bundle = fixture();
  const engine = new SyncEngine(api, bundle);
  assert.equal((await engine.sync()).complete, true);
  const ref = engine.index.assets["recipe:components:Test"];
  const set = nodes.get(ref.id);
  const ids = set.children.map((child: any) => child.id);
  const instance = set.children[0].createInstance();
  const main = await instance.getMainComponentAsync();
  const next = structuredClone(bundle);
  next.recipes[0].assetName = "Inputs/Test";
  next.recipes[0].libraryCategory = "Inputs";
  const result = await new SyncEngine(api, next).sync();
  assert.deepEqual(result.errors, []);
  assert.equal(result.complete, true);
  assert.equal(nodes.get(ref.id), set);
  assert.equal(set.name, "Inputs/Test");
  assert.deepEqual(
    set.children.map((child: any) => child.id),
    ids,
  );
  assert.equal(await instance.getMainComponentAsync(), main);
  assert.equal((await new SyncEngine(api, next).sync()).counts.update ?? 0, 0);
  // Local changes still require review even when a category update is available.
  set.name = "My custom name";
  next.recipes[0].assetName = "Other/Test";
  const conflict = await new SyncEngine(api, next).inspect();
  assert.equal(conflict.counts.conflict, 1);
  assert.equal(set.name, "My custom name");
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
  assert.ok(set.description.includes(recipe.documentation.description));
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
  assert.ok(nodes.get(setId).description.startsWith("Updated guidance"));
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
  (api as any).createNodeFromSvg = (svg: string) => {
    if (first) {
      first = false;
      throw Error("Simulated SVG failure");
    }
    return create(svg);
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
test("native one-link documentation limit cannot abort component generation before the first variant", async () => {
  const { api, nodes } = mockApi();
  const bundle = fixture();
  bundle.recipes[0].documentation = {
    purpose: "Choose an action",
    usage: "Use actions",
    properties: "State",
    description: "Purpose and usage",
    origin: "editorial",
    metadataSource: null,
    links: [
      { uri: "https://example.com/docs" },
      { uri: "https://example.com/source" },
    ],
  };
  const engine = new SyncEngine(api, bundle);
  const result = await engine.sync();
  assert.deepEqual(result.errors, []);
  assert.equal(result.complete, true);
  const set = nodes.get(engine.index.assets["recipe:components:Test"].id);
  assert.equal(set.documentationLinks.length, 1);
  assert.equal(set.children.length, 2);
  assert.equal(set.children[0].children[0].characters, "Original");
  assert.ok(
    set.description.includes("https://example.com/source"),
    "Additional source links must remain reviewable outside the single native link field.",
  );
});
test("interruption at native documentation assignment retains the managed shell and resumes the same identities", async () => {
  const { api, nodes } = mockApi();
  const bundle = fixture();
  bundle.recipes[0].documentation = {
    purpose: "Choose an action",
    usage: "Use actions",
    properties: "State",
    description: "Purpose and usage",
    origin: "editorial",
    metadataSource: null,
    links: [{ uri: "https://example.com/docs" }],
  };
  const original = api.combineAsVariants;
  let first = true;
  (api as any).combineAsVariants = (...args: any[]) => {
    const set = (original as any)(...args);
    const property = Object.getOwnPropertyDescriptor(
      set,
      "documentationLinks",
    )!;
    Object.defineProperty(set, "documentationLinks", {
      configurable: true,
      get: property.get,
      set(value) {
        if (first) {
          first = false;
          throw Error("Simulated native documentation setter interruption");
        }
        property.set!.call(set, value);
      },
    });
    return set;
  };
  const initial = new SyncEngine(api, bundle);
  const failed = await initial.sync();
  assert.equal(failed.complete, false);
  assert.match(failed.errors[0], /documentation setter interruption/);
  const setId = initial.index.assets["recipe:components:Test"].id;
  const set = nodes.get(setId),
    seedId = set.children[0].id;
  assert.equal(set.children[0].children.length, 0);
  const resumed = new SyncEngine(api, bundle);
  const result = await resumed.sync();
  assert.deepEqual(result.errors, []);
  assert.equal(result.complete, true);
  assert.equal(resumed.index.assets["recipe:components:Test"].id, setId);
  assert.equal(set.children[0].id, seedId);
  assert.equal(set.children[0].children[0].characters, "Original");
});

test("caught legacy partial pattern adopts only its exact saved native instance slot without duplicating it", async () => {
  const { api, nodes } = mockApi();
  const bundle = fixture();
  const pattern: Bundle["recipes"][number] = {
    id: "patterns/repair",
    name: "RepairPattern",
    package: "fondue-sync/patterns",
    source: ["fixture.tsx"],
    status: "partial",
    limitations: [],
    variants: [
      {
        id: "default",
        props: { State: "Default" },
        root: {
          id: "pattern",
          name: "Pattern",
          kind: "frame",
          children: [
            {
              id: "control",
              name: "Control",
              kind: "componentInstance",
              recipeId: "components:Test",
              variantProps: { State: "Default" },
              text: "Pattern label",
            },
          ],
        },
      },
    ],
  };
  bundle.recipes.push(pattern);
  const engine = new SyncEngine(api, bundle);
  await engine.sync();
  const set = nodes.get(engine.index.assets["recipe:patterns/repair"].id);
  const variant = set.children[0],
    instance = variant.children[0];
  const ids = [set.id, variant.id, instance.id];
  writeMetadata(instance, "identity", "");
  writeMetadata(instance, "component-binding", "");
  await engine.checkpoint(
    {
      id: "recipe:patterns/repair",
      kind: "recipe",
      definition: JSON.stringify({ ...pattern, pending: true }),
    },
    set,
  );
  const repaired = await new SyncEngine(api, bundle).sync();
  assert.equal(repaired.complete, true);
  assert.deepEqual([set.id, variant.id, variant.children[0].id], ids);
  assert.equal(variant.children.length, 1);
  assert.equal(managedData(instance, "identity"), "control");
  writeMetadata(instance, "identity", "");
  await engine.checkpoint(
    {
      id: "recipe:patterns/repair",
      kind: "recipe",
      definition: JSON.stringify({ ...pattern, pending: true }),
    },
    set,
  );
  writeMetadata(
    instance,
    "data-binding",
    JSON.stringify({ userEdit: "preserve" }),
  );
  const blocked = await new SyncEngine(api, bundle).sync();
  assert.equal(blocked.counts.conflict, 1);
  assert.equal(managedData(instance, "identity"), "");
  assert.equal(
    JSON.parse(managedData(instance, "data-binding")).userEdit,
    "preserve",
  );
});

test("frame resize restores HUG for the unconstrained axis after native resize makes both axes fixed", async () => {
  const { api } = mockApi();
  const bundle = fixture();
  const engine = new SyncEngine(api, bundle);
  const parent = api.createFrame();
  const child = api.createFrame();
  parent.appendChild(child);
  const nativeResize = child.resize.bind(child);
  child.resize = (width: number, height: number) => {
    nativeResize(width, height);
    child.primaryAxisSizingMode = "FIXED";
    child.counterAxisSizingMode = "FIXED";
  };
  await engine.layer(
    {
      id: "row",
      kind: "frame",
      name: "Row",
      layout: "HORIZONTAL",
      width: 300,
      children: [],
    },
    parent,
    child,
  );
  assert.equal(child.primaryAxisSizingMode, "FIXED");
  assert.equal(child.counterAxisSizingMode, "AUTO");
  await engine.layer(
    {
      id: "column",
      kind: "frame",
      name: "Column",
      layout: "VERTICAL",
      width: 300,
      children: [],
    },
    parent,
    child,
  );
  assert.equal(child.primaryAxisSizingMode, "AUTO");
  assert.equal(child.counterAxisSizingMode, "FIXED");
});
test("empty raw variant values use a native-safe label while exact source props remain in shared metadata", async () => {
  const { api, nodes } = mockApi();
  const bundle = fixture();
  bundle.recipes[0].variants[0].props = { description: "", state: "default" };
  bundle.recipes[0].variants[1].props = {
    description: "Details",
    state: "disabled",
  };
  const engine = new SyncEngine(api, bundle);
  const result = await engine.sync();
  assert.deepEqual(result.errors, []);
  assert.equal(result.complete, true);
  const set = nodes.get(engine.index.assets["recipe:components:Test"].id);
  assert.ok(set.children[0].name.includes("description=(empty)"));
  assert.equal(
    JSON.parse(managedData(set.children[0], "variant-props")).description,
    "",
  );
  assert.ok(
    set.nativePropertyDefinitionReads
      .filter((names: string[]) =>
        names.some((name) => name.includes("description=")),
      )
      .every(
        (names: string[]) =>
          names.length === 2 &&
          names.every((name) => name.includes("description=")),
      ),
    "Every source variant must be materialized and renamed before native property definitions are read.",
  );
});
test("vertical baseline source alignment is gated before the native setter while horizontal baseline remains supported", async () => {
  const { api, nodes } = mockApi();
  const bundle = fixture();
  for (const v of bundle.recipes[0].variants) {
    v.root.layout = "VERTICAL";
    v.root.counterAlign = "BASELINE";
  }
  const engine = new SyncEngine(api, bundle);
  const result = await engine.sync();
  assert.deepEqual(result.errors, []);
  assert.equal(result.complete, true);
  const set = nodes.get(engine.index.assets["recipe:components:Test"].id);
  assert.equal(set.children[0].counterAxisAlignItems, "MIN");
  assert.throws(() => {
    set.children[0].counterAxisAlignItems = "BASELINE";
  }, /invalid for vertical/);
});
test("later inherited main-component identity does not turn an untouched native instance into local drift", async () => {
  const { api } = mockApi();
  const main = api.createComponent();
  main.name = "Source";
  const instance = main.createInstance();
  const before = await snapshot(instance);
  writeMetadata(main, "identity", "source-root");
  assert.equal(
    readMetadata(instance, "identity"),
    "source-root",
    "Native clone reads inherit main shared data.",
  );
  assert.equal(await snapshot(instance), before);
  writeMetadata(instance, "instance-identity", "authored-slot");
  assert.notEqual(
    await snapshot(instance),
    before,
    "An authored native instance identity remains meaningful managed state.",
  );
});
test("fallback optical icon scaling changes the glyph, remains idempotent and returns to exact source sizes in place", async () => {
  const { api, nodes } = mockApi();
  const bundle = fixture();
  bundle.icons = [
    {
      id: "icon:scale",
      name: "Scale",
      svg: '<svg width="24" height="24"/>',
      source: "24.svg",
      sizes: [
        { size: 16, svg: '<svg width="16" height="16"/>', source: "16.svg" },
        { size: 24, svg: '<svg width="24" height="24"/>', source: "24.svg" },
      ],
    },
  ];
  bundle.recipes[0].variants[0].root.children!.push({
    id: "glyph",
    name: "Glyph",
    kind: "instance",
    iconId: "icon:scale",
    width: 64,
    height: 64,
    iconColor: "semantic",
  });
  const first = new SyncEngine(api, bundle);
  const report = await first.sync();
  assert.deepEqual(report.errors, []);
  const host = nodes.get(first.index.assets["recipe:components:Test"].id),
    instance = host.children[0].children[1],
    id = instance.id;
  assert.equal((await instance.getMainComponentAsync()).name, "Size=24");
  assert.equal(instance.scaleFactor, 64 / 24);
  assert.equal(instance.width, 64);
  assert.equal(instance.children[0].width, 64);
  assert.equal(instance.children[0].children[0].width, 64);
  assert.equal(
    instance.children[0].children[0].fills[0].boundVariables.color.id,
    first.index.assets["token:semantic"].id,
  );
  const repeat = await new SyncEngine(api, bundle).sync();
  assert.equal(repeat.complete, true);
  assert.equal(instance.children[0].width, 64);
  assert.equal(instance.rescaleCalls.length, 1);
  const exact = structuredClone(bundle);
  Object.assign(exact.recipes[0].variants[0].root.children![1], {
    width: 16,
    height: 16,
  });
  const changed = await new SyncEngine(api, exact).sync();
  assert.deepEqual(
    changed.errors,
    [],
    JSON.stringify(changed.actions.filter((a) => a.action === "conflict")),
  );
  assert.equal(instance.id, id);
  assert.equal((await instance.getMainComponentAsync()).name, "Size=16");
  assert.equal(instance.scaleFactor, 1);
  assert.equal(instance.children[0].width, 16);
});
test("legacy wrapper-only resize is repaired without detaching or resetting instance overrides", async () => {
  const { api } = mockApi();
  const main = api.createComponent();
  main.resize(24, 24);
  const vector = api.createRectangle();
  vector.resize(24, 24);
  main.appendChild(vector);
  const node: any = main.createInstance();
  node.resize(64, 64);
  node.resetOverrides = () => {
    throw Error("Do not discard user overrides");
  };
  const engine = new SyncEngine(api, fixture());
  engine.index.assets["icon:icon:legacy"] = { id: main.id, kind: "icon" };
  const parent: any = api.createFrame();
  parent.appendChild(node);
  await engine.layer(
    {
      id: "glyph",
      name: "Glyph",
      kind: "instance",
      iconId: "icon:legacy",
      width: 64,
      height: 64,
    },
    parent,
    node,
  );
  assert.equal(node.width, 64);
  assert.equal(node.children[0].width, 64);
  assert.equal(node.scaleFactor, 64 / 24);
});
test("ellipse recipe radius does not assign unsupported native cornerRadius", async () => {
  const { api } = mockApi();
  const engine = new SyncEngine(api, fixture());
  const parent = api.createFrame();
  const ellipse = await engine.layer(
    {
      id: "dot",
      name: "Dot",
      kind: "ellipse",
      width: 16,
      height: 16,
      radius: 8,
    },
    parent,
  );
  assert.equal(ellipse.type, "ELLIPSE");
  assert.throws(() => {
    ellipse.cornerRadius = 8;
  }, /no cornerRadius/);
});

const imagePngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jwGQAAAAASUVORK5CYII=";
function imageFixture() {
  const bundle = fixture();
  const bytes = Buffer.from(imagePngBase64, "base64");
  bundle.imageAssets = [
    {
      id: "photo",
      sha256: imageSha256(bytes),
      base64: imagePngBase64,
      mimeType: "image/png",
      width: 1,
      height: 1,
    },
  ];
  for (const variant of bundle.recipes[0].variants)
    Object.assign(variant.root, {
      imageAssetId: "photo",
      imageAssetSha256: bundle.imageAssets[0].sha256,
      imageScaleMode: "CROP",
      imageTransform: [
        [0.8, 0, 0.1],
        [0, 0.8, 0.1],
      ],
      bindings: {},
      width: 120,
      height: 80,
    });
  return bundle;
}
function installImageApi(api: PluginAPI) {
  const images = new Map<string, any>();
  let created = 0;
  api.createImage = (bytes: Uint8Array) => {
    assert(bytes instanceof Uint8Array);
    const hash = "native-image-" + imageSha256(bytes);
    const image = { hash };
    images.set(hash, image);
    created++;
    return image as Image;
  };
  api.getImageByHash = (hash: string) => images.get(hash) ?? null;
  return {
    images,
    get created() {
      return created;
    },
  };
}
test("native offline image fill is editable, cropped, cached across importer reopen, and repeat creates no image/nodes", async () => {
  const { api, nodes } = mockApi(),
    native = installImageApi(api),
    bundle = imageFixture();
  const engine = new SyncEngine(api, bundle);
  const first = await engine.sync();
  assert.deepEqual(first.errors, []);
  const set = nodes.get(engine.index.assets["recipe:components:Test"].id),
    variant = set.children[0];
  assert.equal(native.created, 1);
  assert.equal(variant.fills[0].type, "IMAGE");
  assert.equal(variant.fills[0].scaleMode, "CROP");
  assert.deepEqual(variant.fills[0].imageTransform, [
    [0.8, 0, 0.1],
    [0, 0.8, 0.1],
  ]);
  assert.equal(variant.width, 120);
  const ids = [set.id, variant.id, variant.children[0].id],
    count = nodes.size;
  const repeated = await new SyncEngine(api, bundle).sync();
  assert.deepEqual(repeated.errors, []);
  assert.equal(native.created, 1);
  assert.equal(nodes.size, count);
  assert.deepEqual([set.id, variant.id, variant.children[0].id], ids);
  const updated = structuredClone(bundle);
  for (const v of updated.recipes[0].variants)
    v.root.imageTransform = [
      [0.6, 0, 0.2],
      [0, 0.6, 0.2],
    ];
  assert.deepEqual((await new SyncEngine(api, updated).sync()).errors, []);
  assert.equal(native.created, 1);
  assert.deepEqual(variant.fills[0].imageTransform, [
    [0.6, 0, 0.2],
    [0, 0.6, 0.2],
  ]);
  assert.deepEqual([set.id, variant.id, variant.children[0].id], ids);
  const changed = structuredClone(updated),
    gif = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  Object.assign(changed.imageAssets![0], {
    base64: gif,
    mimeType: "image/gif",
    sha256: imageSha256(Buffer.from(gif, "base64")),
  });
  for (const v of changed.recipes[0].variants)
    v.root.imageAssetSha256 = changed.imageAssets![0].sha256;
  assert.deepEqual((await new SyncEngine(api, changed).sync()).errors, []);
  assert.equal(native.created, 2);
  assert.equal(
    variant.fills[0].imageHash,
    "native-image-" + changed.imageAssets![0].sha256,
  );
  assert.deepEqual([set.id, variant.id, variant.children[0].id], ids);
});
test("missing/corrupt image rejects before resource or canvas allocation; decode failure is retryable", async () => {
  for (const corrupt of [false, true]) {
    const { api, nodes } = mockApi(),
      native = installImageApi(api),
      bundle = imageFixture();
    if (corrupt) bundle.imageAssets![0].sha256 = "0".repeat(64);
    else bundle.imageAssets = [];
    const count = nodes.size;
    const result = await new SyncEngine(api, bundle).sync();
    assert(result.errors.length);
    assert.equal(nodes.size, count);
    assert.equal(native.created, 0);
  }
  const { api, nodes } = mockApi(),
    bundle = imageFixture();
  installImageApi(api);
  const normal = api.createImage;
  let fail = true;
  api.createImage = (bytes) => {
    if (fail) {
      fail = false;
      throw Error("native decode failed");
    }
    return normal(bytes);
  };
  const count = nodes.size;
  const engine = new SyncEngine(api, bundle),
    first = await engine.sync();
  assert(first.errors.some((e) => e.includes("native decode failed")));
  assert.equal(nodes.size, count);
  assert.deepEqual((await engine.sync()).errors, []);
});

test("fresh component instances retain inherited main binding/style data rather than interpreting it as removed authored overrides", async () => {
  const { api, nodes } = mockApi(),
    bundle = fixture(),
    engine = new SyncEngine(api, bundle);
  assert.deepEqual((await engine.sync()).errors, []);
  const set = nodes.get(engine.index.assets["recipe:components:Test"].id),
    main = set.children[0];
  writeMetadata(
    main,
    "layer-definition",
    JSON.stringify({
      id: "root",
      kind: "frame",
      bindings: {
        paddingLeft: "upstream-padding",
        itemSpacing: "upstream-gap",
      },
      effectStyle: "upstream-shadow",
      textStyle: "upstream-typography",
    }),
  );
  const create = main.createInstance;
  let clears: string[] = [];
  main.createInstance = () => {
    const n = create();
    n.boundVariables = {
      paddingLeft: { type: "VARIABLE_ALIAS", id: "padding-native" },
      itemSpacing: { type: "VARIABLE_ALIAS", id: "gap-native" },
    };
    n.effectStyleId = "shadow-native";
    const setBound = n.setBoundVariable.bind(n);
    n.setBoundVariable = (field: string, value: any) => {
      if (value === null) clears.push(field);
      setBound(field, value);
    };
    const setEffect = n.setEffectStyleIdAsync.bind(n);
    n.setEffectStyleIdAsync = async (id: string) => {
      if (!id) clears.push("effectStyle");
      return setEffect(id);
    };
    return n;
  };
  const instance = await engine.layer(
    {
      id: "part",
      name: "Part",
      kind: "componentInstance",
      recipeId: bundle.recipes[0].id,
    },
    api.createFrame(),
  );
  assert.deepEqual(clears, []);
  assert.equal(instance.boundVariables.paddingLeft.id, "padding-native");
  assert.equal(instance.boundVariables.itemSpacing.id, "gap-native");
  assert.equal(instance.effectStyleId, "shadow-native");
  // A later existing-instance authored definition still clears explicitly removed own bindings.
  writeMetadata(
    instance,
    "layer-definition",
    JSON.stringify({
      id: "part",
      kind: "componentInstance",
      bindings: { paddingLeft: "own-padding" },
      effectStyle: "own-shadow",
    }),
  );
  await engine.layer(
    {
      id: "part",
      name: "Part",
      kind: "componentInstance",
      recipeId: bundle.recipes[0].id,
    },
    instance.parent,
    instance,
  );
  assert.deepEqual(clears, ["paddingLeft", "effectStyle"]);
  assert.equal(instance.boundVariables.itemSpacing.id, "gap-native");
});

test("explicit image migration removes only reviewed owned descendants, preserves outer IDs and resumes from its exact checkpoint", async () => {
  const { api } = mockApi();
  const previous: any = {
    id: "patterns/ReviewedPhoto",
    name: "Photo",
    package: "fondue-sync/patterns",
    source: ["source.tsx"],
    status: "partial",
    limitations: [],
    variants: [
      {
        id: "default",
        props: { State: "Default" },
        root: {
          id: "root",
          name: "Root",
          kind: "frame",
          children: [
            {
              id: "image",
              name: "Image",
              kind: "frame",
              children: [{ id: "art", name: "Art", kind: "rectangle" }],
            },
          ],
        },
      },
    ],
  };
  const next = structuredClone(previous);
  next.variants[0].root.children[0] = {
    id: "image",
    name: "Image",
    kind: "frame",
    imageAssetId: "approved-photo",
    imageAssetSha256: "a".repeat(64),
  };
  const approval = {
    id: previous.id,
    beforeSha256: imageMigrationSourceHash(previous),
    afterSha256: imageMigrationSourceHash(next),
    removals: [
      {
        variantId: "default",
        path: "/root/image/art",
        kind: "rectangle",
        imageRootPath: "/root/image",
      },
    ],
  };
  const variant = api.createComponent(),
    image = api.createFrame(),
    art = api.createRectangle();
  variant.appendChild(image);
  image.appendChild(art);
  const set = api.combineAsVariants([variant], api.currentPage);
  writeMetadata(variant, "identity", "root");
  writeMetadata(variant, "variant", "default");
  writeMetadata(image, "identity", "image");
  writeMetadata(art, "identity", "art");
  const save = async (def: any) =>
    writeMetadata(
      set,
      "applied",
      JSON.stringify({
        nodeId: set.id,
        definition: JSON.stringify(def),
        snapshot: await snapshot(set),
      }),
    );
  await save(previous);
  const ids = [set.id, variant.id, image.id];
  const problems = migrationProblems("recipe", previous, next);
  assert(problems.length);
  assert.deepEqual(
    imageMigrationProblems(previous, next, problems, [approval]),
    [],
  );
  const removed = await applyApprovedImageMigration(api, set, next, save, [
    approval,
  ]);
  assert.deepEqual(removed, [art.id]);
  assert.equal(image.children.length, 0);
  assert.deepEqual([set.id, variant.id, image.id], ids);
  assert.deepEqual(
    await applyApprovedImageMigration(api, set, next, save, [approval]),
    [],
  );
  assert.deepEqual([set.id, variant.id, image.id], ids);
  const unexpected = structuredClone(next);
  unexpected.variants[0].root.children = [];
  assert(
    imageMigrationProblems(
      previous,
      unexpected,
      migrationProblems("recipe", previous, unexpected),
      [approval],
    ).length,
  );
  const stale = structuredClone(previous);
  stale.name = "Different reviewed source";
  assert(
    imageMigrationProblems(
      stale,
      next,
      migrationProblems("recipe", stale, next),
      [approval],
    ).length,
  );
});
test("approved image migration protects foreign geometry even if its presence was recorded in a saved snapshot", async () => {
  const { api } = mockApi();
  const previous: any = {
      id: "patterns/Photo",
      variants: [
        {
          id: "default",
          root: {
            id: "root",
            kind: "frame",
            children: [
              {
                id: "image",
                kind: "frame",
                children: [
                  {
                    id: "art",
                    kind: "frame",
                    children: [{ id: "shape", kind: "rectangle" }],
                  },
                ],
              },
            ],
          },
        },
      ],
    },
    next = structuredClone(previous);
  next.variants[0].root.children[0] = {
    id: "image",
    kind: "frame",
    imageAssetId: "photo",
  };
  const approval = {
    id: previous.id,
    beforeSha256: imageMigrationSourceHash(previous),
    afterSha256: imageMigrationSourceHash(next),
    removals: [
      {
        variantId: "default",
        path: "/root/image/art",
        kind: "frame",
        imageRootPath: "/root/image",
      },
      {
        variantId: "default",
        path: "/root/image/art/shape",
        kind: "rectangle",
        imageRootPath: "/root/image",
      },
    ],
  };
  const variant = api.createComponent(),
    image = api.createFrame(),
    art = api.createFrame(),
    shape = api.createRectangle(),
    foreign = api.createRectangle();
  variant.appendChild(image);
  image.appendChild(art);
  art.appendChild(shape);
  art.appendChild(foreign);
  const set = api.combineAsVariants([variant], api.currentPage);
  for (const [node, id] of [
    [variant, "root"],
    [image, "image"],
    [art, "art"],
    [shape, "shape"],
    [foreign, "user-shape"],
  ] as const)
    writeMetadata(node, "identity", id);
  writeMetadata(variant, "variant", "default");
  writeMetadata(
    set,
    "applied",
    JSON.stringify({
      nodeId: set.id,
      definition: JSON.stringify(previous),
      snapshot: await snapshot(set),
    }),
  );
  let checkpoints = 0;
  await assert.rejects(
    applyApprovedImageMigration(
      api,
      set,
      next,
      async () => {
        checkpoints++;
      },
      [approval],
    ),
    /Foreign or missing child/,
  );
  assert.equal(image.children[0].id, art.id);
  assert.equal(art.children.length, 2);
  assert.equal(checkpoints, 0);
  assert.equal(readMetadata(set, "image-migration-state"), "");
});

test("approved interrupted image migration aligns a complete owned sibling permutation by identity before positional recovery", async () => {
  const { api } = mockApi();
  const previous: any = {
      id: "patterns/PhotoOrder",
      name: "PhotoOrder",
      package: "fondue-sync/patterns",
      source: ["source.tsx"],
      status: "partial",
      limitations: [],
      variants: [
        {
          id: "default",
          props: { State: "Default" },
          root: {
            id: "root",
            kind: "frame",
            name: "Root",
            children: [
              {
                id: "image",
                kind: "frame",
                name: "Image",
                children: [
                  { id: "initial", kind: "rectangle", name: "Initial" },
                ],
              },
              { id: "dropdown", kind: "frame", name: "Dropdown" },
              { id: "collapse", kind: "frame", name: "Collapse" },
            ],
          },
        },
      ],
    },
    next = structuredClone(previous);
  next.variants[0].root.children[0] = {
    id: "image",
    kind: "frame",
    name: "Image",
    imageAssetId: "photo",
  };
  const approval = {
    id: previous.id,
    beforeSha256: imageMigrationSourceHash(previous),
    afterSha256: imageMigrationSourceHash(next),
    removals: [
      {
        variantId: "default",
        path: "/root/image/initial",
        kind: "rectangle",
        imageRootPath: "/root/image",
      },
    ],
  };
  const variant = api.createComponent(),
    image = api.createFrame(),
    initial = api.createRectangle(),
    dropdown = api.createFrame(),
    collapse = api.createFrame();
  variant.appendChild(image);
  image.appendChild(initial);
  variant.appendChild(collapse);
  variant.appendChild(dropdown);
  const set = api.combineAsVariants([variant], api.currentPage);
  for (const [node, id] of [
    [variant, "root"],
    [image, "image"],
    [initial, "initial"],
    [dropdown, "dropdown"],
    [collapse, "collapse"],
  ] as const)
    writeMetadata(node, "identity", id);
  writeMetadata(variant, "variant", "default");
  const save = async (def: any) =>
    writeMetadata(
      set,
      "applied",
      JSON.stringify({
        nodeId: set.id,
        definition: JSON.stringify(def),
        snapshot: await snapshot(set),
      }),
    );
  await save(previous);
  const ids = [set.id, variant.id, image.id, dropdown.id, collapse.id];
  let interrupted = false;
  await assert.rejects(
    applyApprovedImageMigration(
      api,
      set,
      next,
      async (def) => {
        await save(def);
        if (!interrupted) {
          interrupted = true;
          throw Error("Interrupted immediately after saved removal");
        }
      },
      [approval],
    ),
    /Interrupted immediately/,
  );
  assert.equal(image.children.length, 0);
  assert.deepEqual(
    variant.children.map((n: any) => readMetadata(n, "identity")),
    ["image", "collapse", "dropdown"],
  );
  const engine = new SyncEngine(api, fixture());
  await assert.rejects(
    engine.recoverPendingRecipe(set, next),
    /identity differs/,
  );
  const oldName = collapse.name;
  collapse.name = "Locally edited collapse";
  await assert.rejects(
    applyApprovedImageMigration(api, set, next, save, [approval]),
    /baseline drift/,
  );
  assert.deepEqual(
    variant.children.map((n: any) => readMetadata(n, "identity")),
    ["image", "collapse", "dropdown"],
  );
  collapse.name = oldName;
  await applyApprovedImageMigration(api, set, next, save, [approval]);
  assert.deepEqual(
    variant.children.map((n: any) => readMetadata(n, "identity")),
    ["image", "dropdown", "collapse"],
  );
  assert.deepEqual(
    [set.id, variant.id, image.id, dropdown.id, collapse.id],
    ids,
  );
  await engine.recoverPendingRecipe(set, next);
});

test("variant-specific text and optical icon defaults stay independent while equal defaults and existing public override keys remain shared", async () => {
  const { api, nodes } = mockApi(),
    bundle = fixture();
  const svg = (size: number) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><path d="M0 0 L4 4"/></svg>`;
  bundle.icons = [
    {
      id: "icon:a",
      name: "A",
      svg: svg(24),
      source: "a24.svg",
      sizes: [16, 24].map((size) => ({
        size,
        svg: svg(size),
        source: `a${size}.svg`,
      })),
    },
    {
      id: "icon:b",
      name: "B",
      svg: svg(16),
      source: "b16.svg",
      sizes: [{ size: 16, svg: svg(16), source: "b16.svg" }],
    },
  ];
  const defaults = [
    {
      viewport: "desktop",
      label: "Cookie",
      helper: "Manage cookie usage",
      icon: "icon:a",
      size: 16,
    },
    {
      viewport: "mobile",
      label: "Applications",
      helper: "Manage applications",
      icon: "icon:b",
      size: 16,
    },
    {
      viewport: "tablet",
      label: "Cookie",
      helper: "Manage cookie usage",
      icon: "icon:a",
      size: 16,
    },
    {
      viewport: "wide",
      label: "Cookie",
      helper: "Manage cookie usage",
      icon: "icon:a",
      size: 24,
    },
  ];
  bundle.recipes[0].variants = defaults.map((v) => ({
    id: v.viewport,
    props: { viewport: v.viewport },
    root: {
      id: "root",
      kind: "frame",
      name: "Menu",
      children: [
        { id: "label", kind: "text", name: "Label", text: v.label },
        { id: "helper", kind: "text", name: "Helper", text: v.helper },
        {
          id: "glyph",
          kind: "instance",
          name: "Glyph",
          iconId: v.icon,
          width: v.size,
          height: v.size,
        },
      ],
    },
  }));
  const first = new SyncEngine(api, bundle);
  assert.deepEqual((await first.sync()).errors, []);
  const set = nodes.get(first.index.assets["recipe:components:Test"].id),
    children = set.children,
    desktop = children[0],
    mobile = children[1],
    tablet = children[2],
    wide = children[3];
  const key = (v: any, id: string, field: string) =>
    v.children.find((n: any) => readMetadata(n, "identity") === id)
      .componentPropertyReferences[field];
  const desktopHelper = key(desktop, "helper", "characters"),
    desktopGlyph = key(desktop, "glyph", "mainComponent");
  const outside = desktop.createInstance();
  outside.setProperties({ [desktopHelper]: "Custom cookie helper" });
  const ids = children.map((v: any) => [
    v.id,
    ...v.children.map((n: any) => n.id),
  ]);
  // Model the observed native legacy defect: correct source metadata/characters,
  // but mobile/large layers reference the first variant's shared default property.
  for (const v of [mobile, wide]) {
    v.children.find(
      (n: any) => readMetadata(n, "identity") === "helper",
    ).componentPropertyReferences.characters = desktopHelper;
    v.children.find(
      (n: any) => readMetadata(n, "identity") === "glyph",
    ).componentPropertyReferences.mainComponent = desktopGlyph;
  }
  assert.equal(
    set.componentPropertyDefinitions[key(mobile, "helper", "characters")]
      .defaultValue,
    "Manage cookie usage",
  );
  await first.checkpoint(
    first.entries().find((x) => x.entry.kind === "recipe")!.entry,
    set,
  );
  const updated = structuredClone(bundle);
  updated.provenance.rendererRevision = "variant-default-fix";
  updated.fingerprint = "variant-default-fix";
  assert.deepEqual((await new SyncEngine(api, updated).sync()).errors, []);
  assert.equal(key(desktop, "helper", "characters"), desktopHelper);
  assert.equal(key(tablet, "helper", "characters"), desktopHelper);
  assert.notEqual(key(mobile, "helper", "characters"), desktopHelper);
  assert.equal(
    set.componentPropertyDefinitions[key(mobile, "helper", "characters")]
      .defaultValue,
    "Manage applications",
  );
  assert.equal(key(tablet, "glyph", "mainComponent"), desktopGlyph);
  assert.notEqual(key(mobile, "glyph", "mainComponent"), desktopGlyph);
  assert.notEqual(key(wide, "glyph", "mainComponent"), desktopGlyph);
  assert.equal(
    set.componentPropertyDefinitions[key(wide, "glyph", "mainComponent")]
      .defaultValue,
    (
      await wide.children
        .find((n: any) => readMetadata(n, "identity") === "glyph")
        .getMainComponentAsync()
    ).id,
  );
  assert.deepEqual(
    children.map((v: any) => [v.id, ...v.children.map((n: any) => n.id)]),
    ids,
  );
  assert.equal(
    outside.componentProperties[desktopHelper].value,
    "Custom cookie helper",
  );
  const engine = new SyncEngine(api, updated),
    instance = await engine.layer(
      {
        id: "mobile-slot",
        name: "Mobile",
        kind: "componentInstance",
        recipeId: bundle.recipes[0].id,
        variantProps: { viewport: "mobile" },
        textOverrides: { helper: "Custom mobile helper" },
      },
      api.createFrame(),
    );
  assert.equal(instance.children[1].characters, "Custom mobile helper");
  assert.equal(
    instance.componentProperties[desktopHelper].value,
    "Manage cookie usage",
  );
});

test("product composition upgrades owned frames to base instances, retaining mains and preserving local drift", async () => {
  const { api, nodes } = mockApi();
  const before = fixture();
  before.recipes.push({
    id: "patterns/composition",
    name: "ProductionComposition",
    package: "fondue-sync/patterns",
    source: ["fixture.tsx"],
    status: "partial",
    limitations: [],
    variants: [
      {
        id: "default",
        props: { State: "Default" },
        root: {
          id: "pattern",
          name: "Pattern",
          kind: "frame",
          children: [
            {
              id: "control",
              name: "Control",
              kind: "frame",
              children: [
                { id: "old-label", name: "Label", kind: "text", text: "Old" },
              ],
            },
          ],
        },
      },
    ],
  });
  const initial = new SyncEngine(api, before);
  assert.equal((await initial.sync()).complete, true);
  const set = nodes.get(initial.index.assets["recipe:patterns/composition"].id);
  const setId = set.id,
    mainId = set.children[0].id;
  const next = structuredClone(before);
  const pattern = next.recipes[1];
  pattern.compositionPolicy = 1;
  pattern.variants[0].root.children = [
    {
      id: "control",
      name: "Control",
      kind: "componentInstance",
      recipeId: "components:Test",
      variantProps: { State: "Default" },
      text: "Linked",
      instanceOverrides: { label: { visible: false } },
    },
  ];
  const changed = await new SyncEngine(api, next).sync();
  assert.deepEqual(
    changed.errors,
    [],
    JSON.stringify(changed.actions.filter((a) => a.action === "conflict")),
  );
  assert.equal(changed.complete, true);
  assert.equal(set.id, setId);
  assert.equal(set.children[0].id, mainId);
  const control = set.children[0].children[0];
  assert.equal(set.children[0].children.length, 1);
  assert.equal(control.type, "INSTANCE");
  assert.equal(
    (await control.getMainComponentAsync()).id,
    nodes.get(initial.index.assets["recipe:components:Test"].id).children[0].id,
  );
  assert.equal(control.children[0].visible, false);
  assert.equal(control.children[0].characters, "Linked");
  const stable = await new SyncEngine(api, next).sync();
  assert.equal(stable.complete, true);
  assert.equal(stable.counts.update ?? 0, 0);
  control.opacity = 0.5;
  control.overrides = [{ id: control.id, overriddenFields: ["opacity"] }];
  const edited = structuredClone(next);
  edited.recipes[1].variants[0].root.children![0].text = "New release";
  const blocked = await new SyncEngine(api, edited).sync();
  assert.equal(blocked.counts.conflict, 1);
  assert.equal(control.opacity, 0.5);
  assert.equal(set.children[0].children[0].id, control.id);
});

test("composition containers replace exact retired anatomy after building base controls and preserve foreign children", async () => {
  for (const foreign of [false, true]) {
    const { api, nodes } = mockApi();
    const before = fixture();
    const recipe: Bundle["recipes"][number] = {
      id: "patterns/container",
      name: "ProductionContainer",
      package: "fondue-sync/patterns",
      source: ["fixture.tsx"],
      status: "partial",
      limitations: [],
      variants: [
        {
          id: "default",
          props: { State: "Default" },
          root: {
            id: "root",
            name: "Root",
            kind: "frame",
            children: [
              {
                id: "actions",
                name: "Actions",
                kind: "frame",
                children: [
                  {
                    id: "old-icon",
                    name: "Icon",
                    kind: "rectangle",
                    width: 16,
                    height: 16,
                  },
                  {
                    id: "old-label",
                    name: "Label",
                    kind: "text",
                    text: "Mark all",
                  },
                ],
              },
            ],
          },
        },
      ],
    };
    before.recipes.push(recipe);
    const initial = new SyncEngine(api, before);
    assert.equal((await initial.sync()).complete, true);
    const set = nodes.get(initial.index.assets["recipe:patterns/container"].id);
    const main = set.children[0],
      actions = main.children[0],
      icon = actions.children[0];
    const identities = [set.id, main.id, actions.id];
    if (foreign) {
      const userChild = api.createRectangle();
      actions.appendChild(userChild);
      await initial.checkpoint(
        {
          id: "recipe:patterns/container",
          kind: "recipe",
          definition: JSON.stringify(recipe),
        },
        set,
      );
    }
    const next = structuredClone(before);
    next.recipes[1].compositionPolicy = 1;
    next.recipes[1].variants[0].root.children![0].children = [
      {
        id: "mark-all",
        name: "Mark all",
        kind: "componentInstance",
        componentRole: "button",
        recipeId: "components:Test",
        variantProps: { State: "Default" },
        text: "Mark all",
      },
    ];
    const result = await new SyncEngine(api, next).sync();
    assert.deepEqual([set.id, main.id, actions.id], identities);
    if (foreign) {
      assert.equal(result.counts.conflict, 1);
      assert.equal(actions.children.length, 3);
      assert.equal(actions.children[2].type, "RECTANGLE");
    } else {
      assert.deepEqual(result.errors, []);
      assert.equal(result.complete, true);
      assert.equal(actions.children.length, 1);
      assert.equal(actions.children[0].type, "INSTANCE");
      assert.equal(managedData(actions.children[0], "identity"), "mark-all");
      const repeat = await new SyncEngine(api, next).sync();
      assert.equal(repeat.complete, true);
      assert.equal(repeat.counts.update ?? 0, 0);
    }
  }
});

test("native content slots keep one property across variants, retain instance content and update main defaults in place", async () => {
  const bundle = fixture();
  for (const variant of bundle.recipes[0].variants)
    variant.root.contentSlot = { id: "content", name: "Content" };
  const { api } = mockApi();
  const engine = new SyncEngine(api, bundle);
  const first = await engine.sync();
  assert.equal(first.complete, true, first.errors.join("\n"));
  const set: any = await api.getNodeByIdAsync(
    engine.index.assets["recipe:components:Test"].id,
  );
  const slots = set.children.map((main: any) => main.children[0]);
  assert.ok(slots.every((slot: any) => slot.type === "SLOT"));
  const keys = Object.entries(set.componentPropertyDefinitions).filter(
    ([, property]: any) => property.type === "SLOT",
  );
  assert.equal(keys.length, 1);
  assert.equal(keys[0][0].split("#")[0], "Content");
  assert.ok(
    slots.every(
      (slot: any) =>
        slot.componentPropertyReferences.slotContentId === keys[0][0],
    ),
  );
  assert.ok(
    slots.every(
      (slot: any) => !slot.children[0].componentPropertyReferences?.characters,
    ),
  );
  assert.ok(
    Object.values(set.componentPropertyDefinitions).every(
      (property: any) => property.type !== "TEXT",
    ),
  );
  const ids = slots.map((slot: any) => [slot.id, slot.children[0].id]);
  const instance = set.children[0].createInstance();
  const custom = api.createFrame();
  custom.name = "Designer-owned content";
  instance.children[0].appendChild(custom);
  const nativeContents = instance.children[0].children.map(
    (child: any) => child.id,
  );
  bundle.recipes[0].variants[0].root.children![0].text =
    "Updated library default";
  bundle.recipes[0].variants[0].root.padding = 24;
  bundle.fingerprint = "slot-update";
  const updated = await engine.sync();
  assert.equal(updated.complete, true, updated.errors.join("\n"));
  assert.deepEqual(
    set.children.map((main: any) => [
      main.children[0].id,
      main.children[0].children[0].id,
    ]),
    ids,
  );
  assert.equal(slots[0].children[0].characters, "Updated library default");
  assert.deepEqual(
    instance.children[0].children.map((child: any) => child.id),
    nativeContents,
  );
  const repeat = await engine.inspect();
  assert.equal(repeat.counts.update ?? 0, 0);
  assert.equal(repeat.counts.conflict ?? 0, 0);
});

test("slot migration blocks implicit adoption, removal and identity changes", () => {
  const previous = fixture().recipes[0];
  const next = structuredClone(previous);
  next.variants[0].root.contentSlot = { id: "content", name: "Content" };
  assert.ok(
    migrationProblems("recipe", previous, next).some(
      (problem) => problem.code === "slot-adoption",
    ),
  );
  const slotted = structuredClone(next);
  next.variants[0].root.contentSlot!.id = "replacement";
  assert.ok(
    migrationProblems("recipe", slotted, next).some(
      (problem) => problem.code === "slot-migration",
    ),
  );
  delete next.variants[0].root.contentSlot;
  assert.ok(
    migrationProblems("recipe", slotted, next).some(
      (problem) => problem.code === "slot-migration",
    ),
  );
});

test("an interrupted native-slot import resumes the same slot identity", async () => {
  const bundle = fixture();
  for (const variant of bundle.recipes[0].variants)
    variant.root.contentSlot = { id: "content", name: "Content" };
  const { api } = mockApi();
  const makeText = api.createText;
  let fail = true;
  api.createText = () => {
    if (fail) {
      fail = false;
      throw Error("Interrupted slot default creation");
    }
    return makeText();
  };
  const engine = new SyncEngine(api, bundle);
  const first = await engine.sync();
  assert.equal(first.complete, false);
  const set: any = await api.getNodeByIdAsync(
    engine.index.assets["recipe:components:Test"].id,
  );
  const slotId = set.children[0].children[0].id;
  assert.equal(set.children[0].children[0].type, "SLOT");
  const reopened = new SyncEngine(api, bundle);
  const resumed = await reopened.sync();
  assert.equal(resumed.complete, true, resumed.errors.join("\n"));
  assert.equal(set.children[0].children[0].id, slotId);
  assert.equal(set.children[0].children[0].children[0].characters, "Original");
});

import { compose } from "../src/composer";
async function compositionFixture() {
  const bundle = structuredClone(releaseBundle) as unknown as Bundle;
  const ids = new Set([
    "components/SegmentedControl.Root",
    "components/SegmentedControl.Item",
    "components/Table.Root",
    "components/Table.EditableRow",
    "components/Table.ContentCell",
    "components/Table.HeaderCell",
  ]);
  bundle.recipes = bundle.recipes.filter((recipe) => ids.has(recipe.id));
  const iconIds = new Set<string>();
  const walk = (node: any) => {
    if (node.iconId) iconIds.add(node.iconId);
    for (const child of node.children ?? []) walk(child);
  };
  bundle.recipes.forEach((recipe) =>
    recipe.variants.forEach((variant) => walk(variant.root)),
  );
  bundle.icons = bundle.icons.filter((icon) => iconIds.has(icon.id));
  bundle.examples = [];
  bundle.inventory = [];
  bundle.gaps = [];
  const mock = mockApi(true);
  const engine = new SyncEngine(mock.api, bundle);
  const report = await engine.sync();
  assert.equal(report.complete, true, report.errors.join("\n"));
  return { ...mock, engine };
}
test("composition actions insert five linked segments and enforce one selected item", async () => {
  const { api, engine } = await compositionFixture();
  const result = await compose(api, engine.index.assets, "insert-segments", 5);
  const root: any = api.currentPage.selection[0];
  const items = root.children[0].children;
  assert.equal(items.length, 5);
  assert.equal(result.createdNodeIds.length, 4);
  assert.equal(
    items.filter(
      (item: any) => item.componentProperties.selected.value === "true",
    ).length,
    1,
  );
  api.currentPage.selection = [items[3]];
  await compose(api, engine.index.assets, "select-segment");
  assert.equal(
    items.filter(
      (item: any) => item.componentProperties.selected.value === "true",
    ).length,
    1,
  );
  assert.equal(items[3].componentProperties.selected.value, "true");
  assert.equal((await engine.inspect()).counts.conflict ?? 0, 0);
});
test("table actions add a column to every row, align widths and preserve existing cells and content", async () => {
  const { api, engine, nodes } = await compositionFixture();
  await compose(api, engine.index.assets, "insert-table");
  const root: any = api.currentPage.selection[0];
  const rows = root.children[0].children;
  const oldIds = rows.map((row: any) =>
    row.children[0].children.map((cell: any) => cell.id),
  );
  const text = rows[1].children[0].children[0].findAllWithCriteria({
    types: ["TEXT"],
  })[0];
  text.characters = "Keep this customer content";
  await compose(api, engine.index.assets, "add-column");
  assert.ok(rows.every((row: any) => row.children[0].children.length === 4));
  assert.deepEqual(
    rows.map((row: any) =>
      row.children[0].children.slice(0, 3).map((cell: any) => cell.id),
    ),
    oldIds,
  );
  assert.equal(text.characters, "Keep this customer content");
  const selected = rows[1].children[0].children[1];
  selected.resize(216, selected.height);
  const count = nodes.size;
  await assert.rejects(
    compose(api, engine.index.assets, "add-column"),
    /widths differ/,
  );
  assert.equal(nodes.size, count);
  api.currentPage.selection = [selected];
  await compose(api, engine.index.assets, "match-column-width");
  assert.ok(
    rows.every((row: any) => row.children[0].children[1].width === 216),
  );
  api.currentPage.selection = [root];
  await compose(api, engine.index.assets, "add-row");
  assert.equal(rows.length, 5);
  assert.equal(rows[4].children[0].children.length, 4);
  assert.equal(rows[4].children[0].children[1].width, 216);
  rows[2].children[0].children[0].remove();
  const uneven = nodes.size;
  await assert.rejects(
    compose(api, engine.index.assets, "add-column"),
    /different cell counts/,
  );
  assert.equal(nodes.size, uneven);
  assert.equal(text.characters, "Keep this customer content");
  assert.equal((await engine.inspect()).counts.conflict ?? 0, 0);
});
