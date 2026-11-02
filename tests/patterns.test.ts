import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
// @ts-expect-error Native source-controlled recipe data is emitted as JSON.
import patterns from "../recipes/patterns.mjs";
const root = new URL(
  "../.cache/release/packages/components/src/components/",
  import.meta.url,
);
const recipe = (id: string) =>
  patterns.find((r: any) => r.id === `components/${id}`);
const walk = (n: any): any[] => [n, ...(n.children ?? []).flatMap(walk)];
const source = (path: string) => fs.readFileSync(new URL(path, root), "utf8");

test("complex recipes match actual API separation and never expose invented table density", () => {
  const calendarSource = source("DatePicker/SingleDatePicker.tsx");
  assert.match(calendarSource, /selected\?: DatePickerDate/);
  assert.match(calendarSource, /<DatePickerCalendar/);
  for (const v of recipe("DatePicker").variants)
    assert.deepEqual(Object.keys(v.props), ["selected"]);
  assert.ok(recipe("DatePicker.Input"));
  for (const r of patterns.filter((r: any) => r.name.split("/")[0] === "Table"))
    for (const v of r.variants) assert.equal(v.props.density, undefined);
  assert.ok(recipe("Table.RowCell"));
  assert.match(source("Table/Table.tsx"), /RowCell: TableRowCell/);
});

test("calendar sample uses the real Gregorian October 2026 grid and released source cell metrics", () => {
  const calendar = recipe("DatePicker").variants[0].root;
  const firstWeek = calendar.children.find((n: any) => n.id === "week-0");
  const numbers = firstWeek.children.map(
    (cell: any) => walk(cell).find((n) => n.id === "number").text,
  );
  const firstDay = new Date(Date.UTC(2026, 9, 1)).getUTCDay();
  assert.equal(firstDay, 4);
  assert.equal(numbers[firstDay], "1");
  assert.equal(numbers[0], "27");
  const css = source("DatePicker/styles/datePickerCalendar.module.scss");
  const dayBlock = css.slice(
    css.indexOf(".day {"),
    css.indexOf(".dayButton {"),
  );
  assert.match(dayBlock, /height: sizeToken\.get\(9\)/);
  assert.match(
    source("../utilities/sizeToken.module.scss"),
    /\$value \* 0\.25rem/,
  );
  for (const day of firstWeek.children) {
    assert.equal(day.width, 9 * 0.25 * 16);
    assert.equal(day.height, 9 * 0.25 * 16);
    assert.equal(day.children[0].width, 32);
  }
});

test("Tooltip geometry and typography follow the source spacing utility", () => {
  const css = source("Tooltip/styles/tooltip.module.scss");
  assert.match(
    css,
    /data-tooltip-spacing='compact'[\s\S]*?padding-block: sizeToken\.get\(1\)/,
  );
  const utility = source("../utilities/text.module.scss");
  assert.match(utility, /font-size: 0\.875rem/);
  assert.match(utility, /line-height: 1\.25rem/);
  for (const v of recipe("Tooltip").variants) {
    const content = walk(v.root).find(
      (n) => n.id === "content" && n.kind === "frame",
    );
    const label = walk(content).find((n) => n.kind === "text");
    assert.equal(label.fontSize, 0.875 * 16);
    assert.equal(label.lineHeight, 1.25 * 16);
    assert.equal(content.paddingTop, v.props.padding === "compact" ? 4 : 8);
    assert.equal(content.paddingLeft, v.props.padding === "compact" ? 8 : 12);
    assert.ok(walk(v.root).find((n) => n.id === "arrow").iconColor);
  }
});

test("ColorPicker uses the released case-sensitive format union", () => {
  assert.match(source("ColorPicker/types.ts"), /ColorFormat = 'HEX' \| 'RGBA'/);
  assert.deepEqual(
    recipe("ColorPicker").variants.map((v: any) => v.props.currentFormat),
    ["HEX", "RGBA"],
  );
  assert.deepEqual(
    recipe("ColorPicker.Values").variants.map(
      (v: any) => v.props.currentFormat,
    ),
    ["HEX", "RGBA"],
  );
});

test("complex recipe source pointers, native icons, bindings and bounded matrices all resolve", () => {
  const bundle = JSON.parse(
    fs.readFileSync(
      new URL("../bundles/fondue-13.11.1.json", import.meta.url),
      "utf8",
    ),
  );
  const tokens = new Set(bundle.tokens.map((t: any) => t.id)),
    icons = new Set(bundle.icons.map((t: any) => t.id));
  for (const r of patterns) {
    assert.ok(r.variants.length <= 30, r.id);
    assert.ok(r.source.length, r.id);
    for (const p of r.source)
      assert.ok(
        fs.existsSync(new URL("../.cache/release/" + p, import.meta.url)),
        p,
      );
    for (const v of r.variants)
      for (const n of walk(v.root)) {
        for (const id of Object.values(n.bindings ?? {}))
          assert.ok(tokens.has(id), `${r.id}/${id}`);
        if (n.iconId) assert.ok(icons.has(n.iconId), n.iconId);
        const ids = (n.children ?? []).map((child: any) => child.id);
        assert.equal(new Set(ids).size, ids.length, `${r.id}/${n.id}`);
      }
  }
});

test("Surface offers native slots while retaining every original sample variant identity", () => {
  const surface = recipe("Flyout.Surface");
  const samples = surface.variants.filter(
    (variant: any) => variant.props.contentMode === "sample",
  );
  const slots = surface.variants.filter(
    (variant: any) => variant.props.contentMode === "slot",
  );
  assert.equal(samples.length, 9);
  assert.equal(slots.length, 9);
  for (const variant of samples) {
    assert.equal(
      variant.id,
      `shadow=${variant.props.shadow};rounded=${variant.props.rounded}`,
    );
    assert.equal(variant.root.contentSlot, undefined);
    const slotted = slots.find(
      (candidate: any) =>
        candidate.props.shadow === variant.props.shadow &&
        candidate.props.rounded === variant.props.rounded,
    );
    assert.deepEqual(slotted.root.contentSlot, {
      id: "content",
      name: "Content",
      description:
        "Add, remove and arrange content here. The surrounding Surface retains its library styling.",
    });
    assert.equal(slotted.root.padding, variant.root.padding);
    assert.deepEqual(slotted.root.bindings, variant.root.bindings);
  }
});
