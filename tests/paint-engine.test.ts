import { test } from "node:test";
import assert from "node:assert/strict";
import { SyncEngine } from "../src/engine";
import type { Bundle } from "../src/schema";
function setup() {
  const calls: any[] = [];
  const api: any = {
    root: { getSharedPluginData: () => "" },
    variables: {
      setBoundVariableForEffect: (
        effect: any,
        field: string,
        variable: any,
      ) => {
        calls.push({ kind: "effect", field, id: variable.id });
        return {
          ...effect,
          boundVariables: {
            ...(effect.boundVariables ?? {}),
            [field]: { type: "VARIABLE_ALIAS", id: variable.id },
          },
        };
      },
      setBoundVariableForPaint: (paint: any, field: string, variable: any) => ({
        ...paint,
        boundVariables: {
          [field]: { type: "VARIABLE_ALIAS", id: variable.id },
        },
      }),
    },
  };
  const engine = new SyncEngine(api, {
    schemaVersion: 1,
    release: "test",
    provenance: {},
    tokens: [],
    styles: [],
    icons: [],
    recipes: [],
    inventory: [],
    gaps: [],
    fingerprint: "test",
  } as Bundle);
  engine.token = async (id: string) => ({ id }) as Variable;
  return { engine, calls };
}
test("effect style renderer sends color and all four numeric fields through the native variable API", async () => {
  const { engine, calls } = setup();
  const style: any = {};
  await engine.applyStyle(
    {
      id: "source-shadow-md",
      name: "source/shadow/md",
      type: "EFFECT",
      source: "released/shadow.module.scss",
      effects: [
        {
          type: "DROP_SHADOW",
          color: { r: 0, g: 0, b: 0, a: 0.15 },
          offset: { x: 0, y: 3 },
          radius: 10,
          spread: 0,
        },
      ],
      effectBindings: [
        {
          color: "color",
          radius: "radius",
          spread: "spread",
          offsetX: "x",
          offsetY: "y",
        },
      ],
    },
    style,
  );
  assert.deepEqual(calls.map((c) => c.field).sort(), [
    "color",
    "offsetX",
    "offsetY",
    "radius",
    "spread",
  ]);
  assert.equal(style.effects[0].boundVariables.radius.id, "radius");
  assert.ok(style.description.includes("released/shadow.module.scss"));
});
test("SVG renderer clears accidental container/resize fills and binds selected source paints without changing vector identity", async () => {
  const { engine } = setup();
  const vector: any = {
    id: "vector",
    type: "VECTOR",
    fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }],
    strokes: [
      { type: "SOLID", color: { r: 128 / 255, g: 128 / 255, b: 128 / 255 } },
    ],
  };
  const root: any = {
    id: "svg-root",
    type: "FRAME",
    fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }],
    children: [vector],
  };
  await engine.applySvgPaints(root, {
    clearSvgRootFills: true,
    svgFillNone: true,
    svgPaintBindings: [
      { paint: "stroke", color: "#808080", tokenId: "color-line-mid" },
    ],
  });
  assert.deepEqual(root.fills, []);
  assert.deepEqual(vector.fills, []);
  assert.equal(vector.strokes[0].boundVariables.color.id, "color-line-mid");
  assert.equal(root.children[0].id, "vector");
});
test("source icon default currentColor binding preserves gradient data paints and existing optical vectors", async () => {
  const { engine } = setup();
  const gradient = { type: "GRADIENT_LINEAR", gradientStops: [] };
  const vector: any = {
    id: "optical-vector",
    type: "VECTOR",
    fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }, gradient],
    strokes: [],
  };
  const root: any = { type: "FRAME", fills: [], children: [vector] };
  await engine.applySvgPaints(
    root,
    { clearSvgRootFills: true },
    "color-primary-default",
  );
  assert.equal(
    vector.fills[0].boundVariables.color.id,
    "color-primary-default",
  );
  assert.deepEqual(vector.fills[1], gradient);
  assert.equal(vector.id, "optical-vector");
});
test("shared typography remains linked and inherits metrics and variables without duplicate literal or node font setters", async () => {
  const { engine } = setup();
  const style: any = {
    id: "style-native",
    fontName: { family: "ABC Diatype", style: "Medium" },
    fontSize: 14,
    lineHeight: { unit: "PIXELS", value: 16 },
    letterSpacing: { unit: "PIXELS", value: 0 },
    textCase: "ORIGINAL",
    textDecoration: "NONE",
    boundVariables: { fontWeight: { type: "VARIABLE_ALIAS", id: "weight" } },
  };
  (engine.api as any).getStyleByIdAsync = async () => style;
  (engine.api as any).loadFontAsync = async () => {};
  engine.index.assets["style:source14-16"] = { id: style.id, kind: "style" };
  const data = new Map();
  const metricCalls: string[] = [];
  const node: any = {
    id: "text",
    type: "TEXT",
    width: 100,
    height: 16,
    x: 0,
    y: 0,
    fills: [],
    strokes: [],
    getSharedPluginData: (ns: string, key: string) => data.get(ns + key) ?? "",
    setSharedPluginData: (ns: string, key: string, value: string) =>
      data.set(ns + key, value),
    setTextStyleIdAsync: async (id: string) => {
      node.textStyleId = id;
    },
    setBoundVariable: (field: string) => {
      metricCalls.push(field);
      if (
        [
          "fontSize",
          "fontWeight",
          "fontFamily",
          "lineHeight",
          "letterSpacing",
        ].includes(field)
      )
        node.textStyleId = "";
    },
    resize: () => {},
  };
  for (const field of [
    "fontName",
    "fontSize",
    "lineHeight",
    "letterSpacing",
    "textCase",
    "textDecoration",
  ])
    Object.defineProperty(node, field, {
      get: () => style[field],
      set: () => {
        metricCalls.push("literal:" + field);
        node.textStyleId = "";
      },
    });
  await engine.layer(
    {
      id: "text",
      kind: "text",
      name: "Title",
      text: "Brand assets",
      fontFamily: "Diatype",
      fontSize: 14,
      fontWeight: 500,
      lineHeight: 16,
      letterSpacing: 0,
      textStyle: "source14-16",
      textDecoration: "NONE",
      bindings: {
        fontFamily: "family",
        fontSize: "size",
        fontWeight: "weight",
        lineHeight: "line",
        letterSpacing: "spacing",
        fills: "color",
      },
    },
    {},
    node,
  );
  assert.equal(node.textStyleId, "style-native");
  assert.equal(node.fontSize, 14);
  assert.equal(node.lineHeight.value, 16);
  assert.deepEqual(metricCalls, []);
  assert.equal(node.fills[0].boundVariables.color.id, "color");
});
