import foundations from "./foundations.mjs";
import patterns from "./patterns.mjs";
import {
  clone,
  derived,
  find,
  frame,
  reference,
  region,
  variant,
} from "./composition-helpers.mjs";
const out = [];
for (const source of foundations.filter((r) =>
  ["Box", "Section", "Flex", "ScrollArea"].includes(r.name.split("/")[0]),
)) {
  out.push(
    derived(
      source,
      source.id + ".Editable",
      source.name + "/Editable",
      (root) => {
        const node = source.name.startsWith("ScrollArea")
          ? root.children.find((n) => n.id === "viewport")
          : root;
        node.contentSlot = {
          id: "content",
          name: source.name.startsWith("Flex") ? "Children" : "Content",
          description:
            "Add and arrange your own content. Container styling and layout remain linked.",
        };
        if (source.name.startsWith("ScrollArea")) node.layout = "VERTICAL";
        return root;
      },
      [
        "Editable linked layout container. Native token-bound frames remain appropriate when no shared component shell is needed. Responsive CSS and browser scrolling remain runtime.",
      ],
    ),
  );
}

const gridSource = find(foundations, "components/Grid");
const cellRoot = clone(gridSource.variants[0].root.children[0].children[0]);
const cell = derived(
  { ...gridSource, variants: [variant({ composition: "editable" }, cellRoot)] },
  "components/Grid.EditableCell",
  "Grid/Cell/Editable",
  (root) => {
    root.contentSlot = {
      id: "content",
      name: "Content",
      description:
        "Insert a card or other linked content inside this grid cell.",
    };
    return root;
  },
);
const row = {
  ...clone(gridSource),
  id: "components/Grid.EditableRow",
  name: "Grid/Row/Editable",
  variants: [1, 2, 3, 4].map((columns) =>
    variant(
      { defaultColumns: columns },
      region(
        "row",
        "Cells",
        Array.from({ length: columns }, (_, i) => reference("cell-" + i, cell)),
        { layout: "HORIZONTAL", gap: 0 },
        { minChildren: 1 },
      ),
    ),
  ),
  limitations: [
    "Row-major native layout for one to four columns. Use Add grid cell to append content without rebuilding existing cells.",
  ],
};
const grid = {
  ...clone(gridSource),
  id: "components/Grid.Editable",
  name: "Grid/Editable",
  variants: [1, 2, 3, 4].map((columns) =>
    variant(
      { columns },
      region(
        "grid",
        "Rows",
        [0, 1].map((i) =>
          reference("row-" + i, row, { defaultColumns: columns }),
        ),
        { width: columns * 100 },
        { minChildren: 1 },
      ),
    ),
  ),
  limitations: [
    "Linked rows/cells provide editable row-major composition. Columns are a Figma composition setting; use Reflow grid after changing them. CSS track strings, spanning and dense/column packing remain runtime.",
  ],
};
out.push(cell, row, grid);

const folder = find(patterns, "components/Tree.Folder");
const node = derived(
  folder,
  "components/Tree.EditableNode",
  "Tree/Node/Editable",
  (header, props) => {
    const label = header.children.find((n) => n.id === "label");
    header.children = header.children.map((child) =>
      child.id === "label"
        ? region("content", "Content", [label], {
            layout: "HORIZONTAL",
            layoutSizingHorizontal: "FILL",
          })
        : child.id === "actions"
          ? region("actions", "Actions", [child], { layout: "HORIZONTAL" })
          : child,
    );
    header.id = "header";
    header.layoutSizingHorizontal = "FILL";
    return frame(
      "node",
      [
        header,
        region("children", "Children", [], {
          paddingLeft: 16,
          layoutSizingHorizontal: "FILL",
          visible: props.isExpanded === "true",
        }),
      ],
      { width: 360 },
    );
  },
  [
    "Nest linked nodes in Children to preserve structural hierarchy and 16px indentation. The child region exists while collapsed. Selection, rename, drag/drop and asynchronous loading remain runtime.",
  ],
);
node.variants = node.variants.flatMap((v) =>
  [false, true].map((multiSelect) => {
    const root = clone(v.root);
    root.children[0].children.find((n) => n.id === "checkbox").visible =
      multiSelect;
    return variant({ ...v.props, multiSelect }, root);
  }),
);
const tree = derived(
  find(patterns, "components/Tree"),
  "components/Tree.Editable",
  "Tree/Editable",
  (root, props) => {
    root.contentSlot = {
      id: "nodes",
      name: "Nodes",
      description:
        "Add linked Tree Node instances. Nest children in a node's Children region and reorder siblings within their own region.",
    };
    root.children = [0, 1].map((i) =>
      reference(
        "node-" + i,
        node,
        {
          isExpanded: i === 0 ? props.isExpanded : "false",
          isSelected: "false",
          isDisabled: "false",
          multiSelect: props.multiSelect,
        },
        { layoutSizingHorizontal: "FILL" },
      ),
    );
    return root;
  },
);
out.push(node, tree);
export default out;
