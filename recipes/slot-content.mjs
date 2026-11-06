import patterns from "./patterns.mjs";
import controls from "./controls.mjs";
import base from "./index.mjs";
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
out.push(
  derived(
    find(patterns, "components/Card"),
    "components/Card.Editable",
    "Card/Editable",
    (root) => {
      root.children.find((n) => n.id === "banner").contentSlot = {
        id: "banner",
        name: "Banner content",
        description:
          "Replace the default with supported media, icons or linked banner content.",
      };
      root.children.find((n) => n.id === "content").contentSlot = {
        id: "content",
        name: "Content",
        description:
          "Compose card content here. The card shell and content padding remain shared.",
      };
      root.children.push(
        region("actions", "Actions", [], {
          layout: "HORIZONTAL",
          width: 240,
          padding: 12,
          gap: 8,
        }),
      );
      return root;
    },
  ),
);
for (const source of controls.filter((r) => r.name.startsWith("Notice/"))) {
  const id = source.id + ".Editable";
  out.push(
    derived(
      source,
      id,
      source.name.replace("Notice/", "Notice/Editable/"),
      (root) => {
        root.children = root.children.map((child) =>
          child.id === "message"
            ? region("message", "Message content", [child])
            : child,
        );
        const actions = root.children.find((n) => n.id === "action");
        actions.contentSlot = {
          id: "action",
          name: "Action",
          maxChildren: 1,
          description:
            "Insert one appropriate action component; status and dismiss controls remain library-owned.",
        };
        return root;
      },
    ),
  );
}
out.push(
  derived(
    find(patterns, "components/Tooltip"),
    "components/Tooltip.Editable",
    "Tooltip/Editable",
    (root) => {
      const content = root.children.find((n) => n.id === "content");
      content.contentSlot = {
        id: "content",
        name: "Content",
        description:
          "Compose noninteractive helper text here. Use a Flyout for forms or interactive actions.",
      };
      return root;
    },
  ),
);

const toolbar = find(base, "rte/Toolbar");
const button = find(base, "rte/ToolbarButton");
const blockSource = toolbar.variants[0].root.children.find(
  (n) => n.id === "blocks",
);
const block = derived(
  { ...toolbar, variants: [variant({ state: "default" }, clone(blockSource))] },
  "rte/Toolbar.BlockAction",
  "Toolbar/BlockAction",
  (root) => root,
);
const group = derived(
  {
    ...toolbar,
    variants: [
      variant(
        { kind: "formatting" },
        clone(toolbar.variants[0].root.children[0]),
      ),
      variant({ kind: "blocks" }, clone(blockSource)),
    ],
  },
  "rte/Toolbar.EditableGroup",
  "Toolbar/Group/Editable",
  (root, props) => {
    root.contentSlot = {
      id: "actions",
      name: "Actions",
      minChildren: 1,
      description:
        "Add linked formatting controls or dropdowns. Group padding and spacing stay shared.",
    };
    root.children =
      props.kind === "blocks"
        ? [reference("block", block)]
        : ["B", "I", "U"].map((text, i) =>
            reference("action-" + i, button, {}, { text }),
          );
    return root;
  },
);
const toolbarRoot = derived(
  toolbar,
  "rte/Toolbar.Editable",
  "Toolbar/Editable",
  (root) => {
    root.contentSlot = {
      id: "groups",
      name: "Groups",
      minChildren: 1,
      description:
        "Add and reorder linked action groups, with separators where needed.",
    };
    root.children = [
      reference("formatting", group, { kind: "formatting" }),
      clone(root.children.find((n) => n.id === "separator")),
      reference("blocks", group, { kind: "blocks" }),
    ];
    return root;
  },
);
const floating = derived(
  find(base, "rte/FloatingModalWrapper"),
  "rte/FloatingModalWrapper.Editable",
  "FloatingModalWrapper/Editable",
  (root) => {
    root.contentSlot = {
      id: "content",
      name: "Content",
      description:
        "Replace this example with editor-specific fields and linked controls.",
    };
    return root;
  },
);
out.push(block, group, toolbarRoot, floating);
export default out;
