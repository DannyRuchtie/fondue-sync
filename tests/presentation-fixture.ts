import fs from "node:fs";
import assert from "node:assert/strict";
import type { Bundle } from "../src/schema";
import type { GalleryIndex } from "../src/galleries";
export function presentationFixture() {
  const source = JSON.parse(
    fs.readFileSync(
      new URL("../bundles/fondue-13.11.1.json", import.meta.url),
      "utf8",
    ),
  ) as Bundle;
  let sequence = 0;
  const nodes = new Map<string, any>(),
    variables = new Map<string, any>(),
    styles = new Map<string, any>(),
    collections = new Map<string, any>(),
    fonts = new Set<string>();
  const index: GalleryIndex = { assets: {}, pages: {} };
  const auditAtMove: any[] = [];
  let saves = 0;
  const scalar = (variable: any) => {
    const value = Object.values(variable.valuesByMode).find(
      (v) => typeof v === "number",
    );
    return typeof value === "number" ? value : 0;
  };
  for (const token of source.tokens) {
    const v = {
      id: "v:" + token.id,
      name: token.name,
      resolvedType: token.type,
      variableCollectionId: token.collection,
      valuesByMode: structuredClone(token.values),
      resolveForConsumer(node: any): any {
        let mode: string | undefined;
        for (let owner = node; owner; owner = owner.parent) {
          if (owner.explicitVariableModes?.[this.variableCollectionId]) {
            const modeId =
              owner.explicitVariableModes[this.variableCollectionId];
            mode = collections
              .get(this.variableCollectionId)
              ?.modes.find((m: any) => m.modeId === modeId)?.name;
            break;
          }
        }
        const value: any =
          this.valuesByMode[mode ?? "Light"] ??
          Object.values(this.valuesByMode)[0];
        if (value?.alias)
          return variables.get("v:" + value.alias).resolveForConsumer(node);
        return { resolvedType: this.resolvedType, value };
      },
    };
    variables.set(v.id, v);
    index.assets["token:" + token.id] = { id: v.id, kind: "token" };
  }
  for (const id of ["Primitives", "Semantic"])
    collections.set(id, {
      id,
      modes:
        id === "Semantic"
          ? [
              { name: "Light", modeId: "L" },
              { name: "Dark", modeId: "D" },
            ]
          : [{ name: "Value", modeId: "V" }],
    });
  for (const def of source.styles) {
    const s = {
      ...def,
      id: "s:" + def.id,
      fontName: { family: def.fontFamily, style: def.fontStyle },
      lineHeight:
        typeof def.lineHeight === "number"
          ? { unit: "PIXELS", value: def.lineHeight }
          : def.lineHeight,
      boundVariables: Object.fromEntries(
        Object.entries(def.bindings ?? {}).map(([field, id]) => [
          field,
          { type: "VARIABLE_ALIAS", id: "v:" + id },
        ]),
      ),
    };
    styles.set(s.id, s);
    index.assets["style:" + def.id] = { id: s.id, kind: "style" };
  }
  function make(type: string, name = ""): any {
    const data = new Map<string, string>();
    let busy = false;
    const n: any = {
      id: "n" + ++sequence,
      type,
      name,
      parent: null,
      children: [],
      _x: 0,
      _y: 0,
      _w: 100,
      _h: 40,
      _characters: "",
      _style: "",
      _font: null,
      _fontSize: 14,
      _line: { unit: "PIXELS", value: 18 },
      fills: [],
      strokes: [],
      boundVariables: {},
      explicitVariableModes: {},
      layoutMode: "NONE",
      layoutWrap: "NO_WRAP",
      primaryAxisSizingMode: "FIXED",
      counterAxisSizingMode: "FIXED",
      visible: true,
      getSharedPluginData: (ns: string, key: string) =>
        data.get(ns + ":" + key) ?? "",
      setSharedPluginData: (ns: string, key: string, value: string) =>
        data.set(ns + ":" + key, value),
      setBoundVariable(field: string, v: any) {
        if (v === null) delete this.boundVariables[field];
        else this.boundVariables[field] = { type: "VARIABLE_ALIAS", id: v.id };
        if (
          type === "TEXT" &&
          [
            "fontSize",
            "fontFamily",
            "fontWeight",
            "fontStyle",
            "lineHeight",
          ].includes(field)
        )
          this._style = "";
      },
      appendChild(child: any) {
        if (child.parent) {
          const at = child.parent.children.indexOf(child);
          if (at >= 0) child.parent.children.splice(at, 1);
          if (index.galleryMoveAudits?.length)
            auditAtMove.push({
              nodeId: child.id,
              audit: structuredClone(index.galleryMoveAudits.at(-1)),
            });
        }
        child.parent = this;
        this.children.push(child);
      },
      resize(w: number, h: number) {
        assert.ok(w > 0 && h > 0);
        this._w = w;
        this._h = h;
      },
      resizeWithoutConstraints(w: number, h: number) {
        assert.ok(w > 0 && h > 0);
        // Observed native behavior: a HUG horizontal frame resists a requested
        // resize and keeps the full content width until its axis is FIXED.
        if (
          this.layoutMode === "HORIZONTAL" &&
          this.primaryAxisSizingMode === "AUTO"
        ) {
          this._w =
            this.children.reduce((sum: number, c: any) => sum + c.width, 0) +
            Math.max(0, this.children.length - 1) * value("itemSpacing") +
            value("paddingLeft") +
            value("paddingRight");
        } else this._w = w;
        this._h = h;
      },
      setExplicitVariableModeForCollection(c: any, mode: string) {
        assert.ok(c.modes.some((m: any) => m.modeId === mode));
        this.explicitVariableModes[c.id] = mode;
      },
      async setTextStyleIdAsync(id: string) {
        const s = styles.get(id);
        assert.ok(s?.type === "TEXT");
        assert.ok(fonts.has(s.fontName.family + "/" + s.fontName.style));
        this._style = id;
        this._font = s.fontName;
        this._fontSize = s.fontSize;
        this._line = s.lineHeight;
      },
      async getMainComponentAsync() {
        return this.main;
      },
      swapComponent(main: any) {
        this.main = main;
      },
    };
    const value = (field: string, fallback = 0) => {
      const alias = n.boundVariables[field];
      return alias ? scalar(variables.get(alias.id)) : (n[field] ?? fallback);
    };
    function calculate() {
      if (busy) return;
      busy = true;
      try {
        if (type === "INSTANCE") {
          n._w = n.main.width;
          n._h = n.main.height;
          return;
        }
        if (type === "TEXT") {
          const style = styles.get(n._style),
            sizeAlias = style?.boundVariables.fontSize;
          const fontSize = sizeAlias
            ? scalar(variables.get(sizeAlias.id))
            : (style?.fontSize ?? n._fontSize);
          const lineAlias = style?.boundVariables.lineHeight;
          const line = lineAlias
            ? scalar(variables.get(lineAlias.id))
            : ((style?.lineHeight ?? n._line).value ?? fontSize * 1.2);
          const charsPerLine = Math.max(
            1,
            Math.floor(n._w / (fontSize * 0.54)),
          );
          if (n.textAutoResize === "HEIGHT")
            n._h =
              n._characters
                .split("\n")
                .reduce(
                  (total: number, s: string) =>
                    total + Math.max(1, Math.ceil(s.length / charsPerLine)),
                  0,
                ) * line;
          return;
        }
        if (!["FRAME", "COMPONENT"].includes(type) || n.layoutMode === "NONE")
          return;
        const left = value("paddingLeft"),
          right = value("paddingRight"),
          top = value("paddingTop"),
          bottom = value("paddingBottom"),
          gap = value("itemSpacing");
        if (n.layoutMode === "VERTICAL") {
          let y = top,
            max = 0;
          for (const c of n.children) {
            c._x = left;
            c._y = y;
            y += c.height + gap;
            max = Math.max(max, c.width);
          }
          if (n.primaryAxisSizingMode === "AUTO")
            n._h = (n.children.length ? y - gap : top) + bottom;
          if (n.counterAxisSizingMode === "AUTO") n._w = max + left + right;
        } else if (n.layoutWrap === "WRAP") {
          let x = left,
            y = top,
            row = 0,
            max = 0;
          for (const c of n.children) {
            if (x > left && x + c.width > n._w - right) {
              y += row + value("counterAxisSpacing");
              x = left;
              row = 0;
            }
            c._x = x;
            c._y = y;
            x += c.width + gap;
            row = Math.max(row, c.height);
            max = Math.max(max, c._x + c.width);
          }
          if (n.counterAxisSizingMode === "AUTO") n._h = y + row + bottom;
        } else {
          let x = left,
            max = 0;
          for (const c of n.children) {
            c._x = x;
            c._y = top;
            x += c.width + gap;
            max = Math.max(max, c.height);
          }
          if (n.primaryAxisSizingMode === "AUTO")
            n._w = (n.children.length ? x - gap : left) + right;
          if (n.counterAxisSizingMode === "AUTO") n._h = max + top + bottom;
        }
      } finally {
        busy = false;
      }
    }
    for (const axis of ["x", "y"])
      Object.defineProperty(n, axis, {
        get() {
          n.parent?._calculate?.();
          return n["_" + axis];
        },
        set(v) {
          n["_" + axis] = v;
        },
      });
    Object.defineProperty(n, "width", {
      get() {
        calculate();
        return n._w;
      },
    });
    Object.defineProperty(n, "height", {
      get() {
        calculate();
        return n._h;
      },
    });
    n._calculate = calculate;
    Object.defineProperty(n, "textStyleId", {
      get() {
        return n._style;
      },
      set(v) {
        n._style = v;
      },
    });
    Object.defineProperty(n, "fontName", {
      get() {
        return styles.get(n._style)?.fontName ?? n._font;
      },
      set(v) {
        n._font = v;
        n._style = "";
      },
    });
    Object.defineProperty(n, "fontSize", {
      get() {
        return styles.get(n._style)?.fontSize ?? n._fontSize;
      },
      set(v) {
        n._fontSize = v;
        n._style = "";
      },
    });
    Object.defineProperty(n, "lineHeight", {
      get() {
        return styles.get(n._style)?.lineHeight ?? n._line;
      },
      set(v) {
        n._line = v;
        n._style = "";
      },
    });
    Object.defineProperty(n, "characters", {
      get() {
        return n._characters;
      },
      set(v) {
        const font = n.fontName;
        assert.ok(
          font && fonts.has(font.family + "/" + font.style),
          "Native font must be loaded before text",
        );
        n._characters = v;
      },
    });
    n.createInstance = () => {
      assert.equal(type, "COMPONENT");
      const i = make("INSTANCE");
      i.main = n;
      return i;
    };
    n.findAll = (fn: (node: any) => boolean) => {
      const out: any[] = [];
      const visit = (p: any) => {
        for (const c of p.children) {
          if (fn(c)) out.push(c);
          visit(c);
        }
      };
      visit(n);
      return out;
    };
    nodes.set(n.id, n);
    return n;
  }
  const root = make("DOCUMENT"),
    page = make("PAGE", "Initial");
  root.appendChild(page);
  const api: any = {
    root,
    currentPage: page,
    createPage: () => {
      const p = make("PAGE");
      root.appendChild(p);
      return p;
    },
    createFrame: () => make("FRAME"),
    createText: () => make("TEXT"),
    createRectangle: () => make("RECTANGLE"),
    createSection: () => make("SECTION"),
    setCurrentPageAsync: async (p: any) => {
      api.currentPage = p;
    },
    getNodeByIdAsync: async (id: string) => nodes.get(id) ?? null,
    getStyleByIdAsync: async (id: string) => styles.get(id) ?? null,
    loadFontAsync: async (font: any) => {
      fonts.add(font.family + "/" + font.style);
    },
    variables: {
      getVariableByIdAsync: async (id: string) => variables.get(id) ?? null,
      getVariableCollectionByIdAsync: async (id: string) =>
        collections.get(id) ?? null,
      setBoundVariableForPaint: (paint: any, field: string, v: any) => {
        assert.equal(v.resolvedType, "COLOR");
        return {
          ...paint,
          boundVariables: { [field]: { type: "VARIABLE_ALIAS", id: v.id } },
        };
      },
    },
  };
  function sourcePage(key: string) {
    if (!index.pages[key]) {
      const p = make("PAGE", key);
      root.appendChild(p);
      index.pages[key] = p.id;
    }
    return nodes.get(index.pages[key]);
  }
  function recipe(
    name: string,
    profiles = 1,
    opts: { width?: number; height?: number; package?: string } = {},
  ) {
    const out: any[] = [];
    for (let i = 0; i < profiles; i++) {
      const r = {
        id: "components/" + name + "/" + i,
        name: name + "/" + i,
        package: opts.package ?? "@frontify/fondue/components",
        source: ["source.tsx"],
        status: "partial" as const,
        limitations: [
          "A repeated source limitation.",
          "A repeated source limitation.",
        ],
        documentation: {
          purpose: "Use " + name + " for its intended purpose.",
          usage: "Choose a native configuration.",
          properties: "",
          description: "",
          origin: "test",
          metadataSource: null,
          links: [],
        },
        variants: [
          {
            id: "first",
            props: { size: "medium", state: "default" },
            root: { id: "root", name: "root", kind: "frame" },
          },
        ],
      };
      const set = make("COMPONENT_SET", r.name),
        main = make("COMPONENT", "First"),
        alternate = make("COMPONENT", "Other");
      main.resize(opts.width ?? 90, opts.height ?? 28);
      alternate.resize(480, 80);
      main.setSharedPluginData("fondue_sync", "variant", "first");
      set.appendChild(main);
      set.appendChild(alternate);
      sourcePage("Components").appendChild(set);
      index.assets["recipe:" + r.id] = { id: set.id, kind: "recipe" };
      const guide = make("FRAME", "Detailed " + r.name);
      sourcePage("Documentation").appendChild(guide);
      index.assets["guide:" + r.id] = { id: guide.id, kind: "guide" };
      out.push({ recipe: r, set, main, alternate, guide });
    }
    return out;
  }
  return {
    api: api as PluginAPI,
    index,
    source,
    root,
    page,
    nodes,
    variables,
    styles,
    collections,
    make,
    sourcePage,
    recipe,
    auditAtMove,
    save: () => {
      saves++;
    },
    stats: () => ({ saves, nodeCount: nodes.size }),
  };
}
