/** Additive composition contracts. Existing recipe and variant IDs remain intact. */
import controls from "./controls.mjs";
import patterns from "./patterns.mjs";
const clone = (value) => structuredClone(value);
const base = (id) => patterns.find((r) => r.id === `components/${id}`);
const segmentVariants = controls
  .filter((r) => r.name.startsWith("SegmentedControl/"))
  .flatMap((r) => r.variants);
const segment = (props) =>
  segmentVariants.find((v) =>
    Object.entries(props).every(
      ([key, value]) => v.props[key] === String(value),
    ),
  );
const variant = (props, root) => ({
  id: Object.entries(props)
    .map(([k, v]) => `${k}=${v}`)
    .join(";"),
  props: Object.fromEntries(
    Object.entries(props).map(([k, v]) => [k, String(v)]),
  ),
  root,
});
const reference = (id, recipeId, variantProps, extra = {}) => ({
  id,
  kind: "componentInstance",
  name: id,
  recipeId,
  variantProps,
  ...extra,
});
const recipe = (part, source, variants, limitations) => ({
  id: `components/${part}`,
  name: part.replaceAll(".", "/"),
  package: "@frontify/fondue/components",
  source: clone(source),
  status: "partial",
  limitations,
  variants,
});
const segmentSource = controls.find((r) =>
  r.name.startsWith("SegmentedControl/"),
).source;
const items = [];
for (const selected of [false, true])
  for (const disabled of [false, true])
    for (const iconOnly of [false, true])
      for (const state of ["default", "hover", "focus"]) {
        const root = clone(
          segment({
            selected: selected ? "first" : "second",
            disabled,
            iconOnly,
            hugWidth: false,
            state,
          }).root.children[0],
        );
        root.id = "item";
        root.name = "Segment";
        const label = root.children.find((n) => n.kind === "text");
        if (label) label.text = "Segment";
        items.push(variant({ selected, disabled, iconOnly, state }, root));
      }
const item = recipe("SegmentedControl.Item", segmentSource, items, [
  "Item selected/disabled/iconOnly/state are set on each nested item. Figma does not reproduce React group state or keyboard behavior.",
  "First/last rounding and adjacent separator behavior require context review; the selected outline follows the existing source-state specimen.",
]);
const roots = [true, false].map((hugWidth) => {
  const root = clone(
    segment({
      selected: "first",
      disabled: false,
      iconOnly: false,
      hugWidth,
      state: "default",
    }).root,
  );
  root.contentSlot = {
    id: "items",
    name: "Segments",
    minChildren: 2,
    maxChildren: 10,
    description:
      "Add linked SegmentedControl Item instances. Set exactly one item to selected. Match disabled and iconOnly settings across the group.",
  };
  if (!hugWidth) root.width = 202;
  root.children = [true, false].map((selected, i) =>
    reference(
      `item-${i}`,
      "components/SegmentedControl.Item",
      {
        selected: String(selected),
        disabled: "false",
        iconOnly: "false",
        state: "default",
      },
      { ...(hugWidth ? {} : { layoutSizingHorizontal: "FILL" }) },
    ),
  );
  return variant({ hugWidth }, root);
});
const root = recipe("SegmentedControl.Root", segmentSource, roots, [
  "Native Segments slot contains linked Item instances. Count is content, not a variant axis. Set selection and disabled/iconOnly state on the nested items.",
  "The pinned runtime active-indicator CSS covers up to ten segments; slot layer limits are guidance. Focus management, responsive label clamping and indicator motion remain runtime.",
]);
const cellSource = base("Table.RowCell");
const cells = cellSource.variants.map((v) => {
  const copy = clone(v);
  const content = copy.root.children.find((n) => n.id === "content");
  content.contentSlot = {
    id: "content",
    name: "Content",
    description:
      "Edit cell content or insert linked components. The cell padding and bottom border remain library-owned.",
  };
  return copy;
});
const contentCell = recipe("Table.ContentCell", cellSource.source, cells, [
  "Additive editable counterpart of Table.RowCell. Width and fontSize are contextual. A cell can contain arbitrary designer content through its Content slot.",
  "Column spans, sticky positioning, sort interactions and browser table semantics remain runtime.",
]);
const headerSource = base("Table.HeaderCell");
const headerCell = recipe(
  "Table.ContentHeaderCell",
  headerSource.source,
  headerSource.variants.map((v) => {
    const copy = clone(v);
    const contents = copy.root.children.find((n) => n.id === "contents");
    const label = contents.children.find((n) => n.id === "label");
    contents.children = [
      {
        id: "header-content",
        name: "Header content",
        kind: "frame",
        layout: "HORIZONTAL",
        layoutSizingHorizontal: "FILL",
        contentSlot: {
          id: "content",
          name: "Header content",
          description:
            "Add a label, filter or linked header controls. Sort indicator and cell borders stay shared.",
        },
        children: [label],
      },
      ...contents.children.filter((n) => n.id !== "label"),
    ];
    return copy;
  }),
  [
    "Additive header with native editable content; sort indicator and borders remain library-owned.",
  ],
);
const rows = [];
for (const section of ["header", "body"])
  for (const selected of [false, true])
    for (const disabled of [false, true])
      for (const fontSize of ["small", "medium"]) {
        rows.push(
          variant(
            { section, selected, disabled, fontSize },
            {
              id: "row",
              kind: "frame",
              name: "Row",
              layout: "HORIZONTAL",
              width: 480,
              gap: 0,
              primaryAlign: "MIN",
              counterAlign: "MIN",
              opacity: disabled ? 0.6 : 1,
              bindings: selected
                ? { fills: "color-container-highlight-default" }
                : {},
              contentSlot: {
                id: "cells",
                name: "Cells",
                minChildren: 1,
                description:
                  "Add linked cells. Use Add column to update every row together, and Match column width to keep column widths aligned.",
              },
              children: [0, 1, 2].map((i) =>
                reference(
                  `cell-${i}`,
                  section === "header"
                    ? "components/Table.HeaderCell"
                    : "components/Table.ContentCell",
                  section === "header"
                    ? { sortDirection: "none", state: "idle", align: "left" }
                    : { align: "left", fontSize },
                ),
              ),
            },
          ),
        );
      }
const richHeaderRows = rows
  .filter((v) => v.props.section === "header")
  .map((v) => {
    const copy = clone(v);
    copy.id += ";headerContent=custom";
    copy.props.headerContent = "custom";
    copy.root.children.forEach((cell) => {
      cell.recipeId = headerCell.id;
    });
    return copy;
  });
rows.forEach((v) => {
  v.props.headerContent = "label";
});
const row = recipe(
  "Table.EditableRow",
  base("Table.Row").source,
  [...rows, ...richHeaderRows],
  [
    "Cells are linked components inside a native Cells slot. section is Figma composition context; selected/disabled/fontSize follow Table source context.",
    "Use the composition actions to add columns to all rows or copy a selected cell width across its column. Native slot editing remains available; uneven rows are reported before bulk changes.",
  ],
);
const tableRoot = recipe(
  "Table.Root",
  base("Table").source,
  [
    variant(
      { composition: "editable" },
      {
        id: "table",
        kind: "frame",
        name: "Table",
        layout: "VERTICAL",
        width: 480,
        gap: 0,
        primaryAlign: "MIN",
        counterAlign: "MIN",
        contentSlot: {
          id: "rows",
          name: "Rows",
          minChildren: 1,
          description:
            "Add linked EditableRow instances. Use the table actions to coordinate columns across all rows.",
        },
        children: ["header", "body", "body", "body"].map((section, i) =>
          reference(
            `row-${i}`,
            "components/Table.EditableRow",
            {
              section,
              selected: "false",
              disabled: "false",
              fontSize: "medium",
            },
            { layoutSizingHorizontal: "FILL" },
          ),
        ),
      },
    ),
  ],
  [
    "composition is a Figma-only setting. Header/body rows and cells stay linked; their content belongs to the instance.",
    "Table column operations require a rectangular row structure. Root font context, sticky columns, spans, sorting and accessibility semantics are not simulated.",
  ],
);
const richTable = clone(tableRoot.variants[0]);
richTable.id = "composition=custom-header";
richTable.props.composition = "custom-header";
richTable.root.children[0].variantProps.headerContent = "custom";
tableRoot.variants.push(richTable);
export default [item, root, contentCell, headerCell, row, tableRoot];
