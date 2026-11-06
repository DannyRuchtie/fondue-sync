import patterns from "./patterns.mjs";
import controls from "./controls.mjs";
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

// Accordion items own their expanded content; the collection owns only item layout.
for (const suffix of ["", ".borderless", ".pill", ".sticky"]) {
  const source = find(patterns, "components/Accordion" + suffix);
  const item = derived(
    source,
    source.id + ".EditableItem",
    source.name + "/EditableItem",
    (root, props) => {
      const node = root.children.find((child) => child.id === "item");
      const expanded = source.variants
        .find(
          (v) =>
            v.props.value === "details" &&
            v.props.padding === props.padding &&
            v.props.variant === props.variant,
        )
        ?.root.children.find((n) => n.id === "item");
      const content = clone(
        expanded?.children.find((n) => n.id === "content") ??
          frame("content", []),
      );
      content.contentSlot = {
        id: "content",
        name: "Content",
        description:
          "Compose the expanded item content. The trigger remains linked and library-owned.",
      };
      content.visible = props.value === "details";
      node.children = [node.children[0], content];
      return node;
    },
    [
      "The expanded region exists in every state, preserving its identity while collapsed. Toggle value on the nested item; runtime accordion behavior is not simulated.",
    ],
  );
  const collection = derived(
    source,
    source.id + ".Editable",
    source.name + "/Editable",
    (root, props) => {
      root.children = root.children.map((child) =>
        child.id === "item"
          ? region(
              "items",
              "Items",
              [0, 1, 2].map((i) =>
                reference("item-" + i, item, {
                  ...props,
                  value: i === 0 ? props.value : "",
                }),
              ),
              { width: 340 },
              { minChildren: 1 },
            )
          : child,
      );
      return root;
    },
  );
  out.push(item, collection);
}

// Menus use linked items, headings and separators inside typed group/submenu shells.
const dropdown = find(patterns, "components/Dropdown");
const dropdownItem = find(patterns, "components/Dropdown.Item");
const openMenu = dropdown.variants
  .find((v) => v.props.open === "true")
  .root.children.find((n) => n.id === "content");
const groupDefault = openMenu.children.find((n) => n.id === "group");
const menuGroup = derived(
  {
    ...dropdown,
    variants: [
      variant({ heading: true }, clone(groupDefault)),
      variant(
        { heading: false },
        {
          ...clone(groupDefault),
          children: groupDefault.children
            .filter((n) => n.id !== "heading")
            .map(clone),
        },
      ),
    ],
  },
  "components/Dropdown.EditableGroup",
  "Dropdown/Group/Editable",
  (root) => {
    const heading = root.children.filter((n) => n.id === "heading");
    root.children = [
      ...heading,
      region("items", "Items", [
        reference("first", dropdownItem, {}, { text: "Rename" }),
        reference("second", dropdownItem, {}, { text: "Duplicate" }),
      ]),
    ];
    return root;
  },
);
const submenu = derived(
  find(patterns, "components/Dropdown.SubTrigger"),
  "components/Dropdown.EditableSubmenu",
  "Dropdown/Submenu/Editable",
  (root, props) => {
    const content = clone(openMenu);
    content.id = "submenu-items";
    content.name = "Submenu items";
    content.contentSlot = {
      id: "items",
      name: "Submenu items",
      description: "Insert linked menu items and groups into this submenu.",
    };
    content.visible = props.state === "open";
    content.children = [
      reference("item", dropdownItem, {}, { text: "Destination" }),
    ];
    return frame("submenu", [root, content], { layout: "HORIZONTAL", gap: 8 });
  },
  [
    "Submenu content is present in all states; change the sub-trigger state to open. Positioning/collision handling remain runtime.",
  ],
);
const menu = derived(
  dropdown,
  "components/Dropdown.Editable",
  "Dropdown/Editable",
  (root, props) => {
    const content = clone(openMenu);
    content.contentSlot = {
      id: "items",
      name: "Items",
      description:
        "Add linked menu items, groups, separators and submenus. Item count belongs to this instance.",
    };
    content.visible = props.open === "true";
    content.children = [
      reference("group", menuGroup),
      clone(openMenu.children.find((n) => n.id === "separator")),
      reference("submenu", submenu),
      reference(
        "delete",
        dropdownItem,
        { emphasis: "danger" },
        { text: "Delete" },
      ),
    ];
    root.children = [root.children[0], content];
    return root;
  },
);
out.push(menuGroup, submenu, menu);

const option = find(patterns, "components/Select.Item");
const selectGroup = derived(
  find(patterns, "components/Select.Group"),
  "components/Select.EditableGroup",
  "Select/Group/Editable",
  (root) => {
    const options = root.children.find((n) => n.id === "options");
    options.contentSlot = {
      id: "options",
      name: "Options",
      description: "Add and reorder linked Select Item instances.",
    };
    options.children = [
      reference("first", option, {}, { text: "Brand assets" }),
      reference("second", option, {}, { text: "Documents" }),
    ];
    return root;
  },
);
out.push(selectGroup);
const selectedValueSource = find(patterns, "components/Select.Multiple");
const selectedValue = derived(
  selectedValueSource,
  "components/Select.SelectedValue",
  "Select/SelectedValue",
  (root) => clone(root.children.find((n) => n.id === "badges").children[0]),
);
out.push(selectedValue);
for (const id of [
  "components/Select",
  "components/Select.Multiple",
  "components/Select.Combobox",
]) {
  const source = find(patterns, id);
  const editable = derived(
    source,
    id + ".Editable",
    source.name + "/Editable",
    (trigger) => {
      if (id.includes("Multiple")) {
        const badges = trigger.children.find((n) => n.id === "badges");
        badges.contentSlot = {
          id: "selected-values",
          name: "Selected values",
          description:
            "Add linked selected-value badges. Keep them consistent with the selected menu options.",
        };
        badges.children = [
          reference("selected-value", selectedValue, {}, { text: "Images" }),
        ];
      }
      const menuShell = clone(openMenu);
      menuShell.id = "options";
      menuShell.name = "Options";
      menuShell.width = 280;
      menuShell.contentSlot = {
        id: "options",
        name: "Options",
        description:
          "Add options or linked groups. Highlight and selected states are set on each option.",
      };
      menuShell.children = [reference("group", selectGroup)];
      return frame("select-composition", [trigger, menuShell], {
        width: 280,
        gap: 4,
      });
    },
    [
      "The trigger remains a linked visual contract. Menu options and multiple selected-value badges are designer content. Update their selection consistently; filtering and value synchronization remain runtime.",
    ],
  );
  out.push(editable);
}

// Radio options retain source focus/checked geometry, with a collection slot for count.
const radioSources = controls.filter((r) => r.name.startsWith("RadioList/"));
const radioVariants = radioSources.flatMap((r) => r.variants);
const radioItem = {
  ...clone(radioSources[0]),
  id: "components/RadioList.EditableOption",
  name: "RadioList/Option",
  variants: [],
};
for (const emphasis of ["default", "highlight"])
  for (const selected of [false, true])
    for (const state of ["default", "hover", "disabled", "focus"]) {
      const source = radioVariants.find(
        (v) =>
          v.props.emphasis === emphasis &&
          v.props.selected === (selected ? "first" : "second") &&
          v.props.state === state,
      );
      if (!source) throw Error("Missing source radio state");
      const root = clone(source.root.children[0]);
      root.id = "option";
      radioItem.variants.push(variant({ emphasis, selected, state }, root));
    }
radioItem.limitations = [
  "Single-option source geometry. Set exactly one option selected; group direction belongs to the collection.",
];
out.push(radioItem);
// 2x2x4=16 variants: no count axis and no expansion of source state partitions.
const radioRoot = derived(
  radioSources[0],
  "components/RadioList.Editable",
  "RadioList/Editable",
  (root) => root,
);
radioRoot.variants = [];
for (const emphasis of ["default", "highlight"])
  for (const orientation of ["vertical", "horizontal"])
    for (const state of ["default", "hover", "disabled", "focus"]) {
      const source = radioVariants.find(
        (v) =>
          v.props.emphasis === emphasis &&
          v.props.orientation === orientation &&
          v.props.state === state,
      );
      const root = clone(source.root);
      root.contentSlot = {
        id: "options",
        name: "Options",
        minChildren: 1,
        description:
          "Add linked RadioList Option instances. Set exactly one selected; apply disabled state consistently.",
      };
      root.children = [true, false, false].map((selected, i) =>
        reference(
          "option-" + i,
          radioItem,
          { emphasis, selected, state },
          { text: "Option " + (i + 1) },
        ),
      );
      radioRoot.variants.push(variant({ emphasis, orientation, state }, root));
    }
out.push(radioRoot);

const listItem = derived(
  find(patterns, "components/OrderableList.Item"),
  "components/OrderableList.EditableItem",
  "OrderableList/Item/Editable",
  (root) => {
    const content = root.children.find((n) => n.id === "content");
    content.contentSlot = {
      id: "content",
      name: "Content",
      description:
        "Compose row content here. The drag handle remains library-owned.",
    };
    const handleIndex = root.children.findIndex((n) => n.id === "drag-handle");
    root.children.splice(
      handleIndex,
      0,
      region("actions", "Actions", [], { layout: "HORIZONTAL", gap: 4 }),
    );
    return root;
  },
);
const list = derived(
  find(patterns, "components/OrderableList"),
  "components/OrderableList.Editable",
  "OrderableList/Editable",
  (root) => {
    root.contentSlot = {
      id: "items",
      name: "Items",
      description:
        "Add, duplicate and reorder linked OrderableList Item instances.",
    };
    root.children = [0, 1, 2].map((i) =>
      reference("item-" + i, listItem, {
        selected: "false",
        disabled: "false",
        padding: "none",
      }),
    );
    return root;
  },
);
out.push(listItem, list);

// Tabs are paired linked items. Both label and panel stay in one repeated pair.
const tabsSource = find(patterns, "components/Tabs");
const tabsTrigger = derived(
  find(patterns, "components/Tabs.Trigger"),
  "components/Tabs.EditableTrigger",
  "Tabs/Trigger/Editable",
  (root) => root,
);
tabsTrigger.variants = tabsTrigger.variants.map((v) => {
  const { activeTab, ...props } = v.props;
  return variant({ ...props, selected: activeTab === "overview" }, v.root);
});
const tabsPanel = derived(
  find(patterns, "components/Tabs.Content"),
  "components/Tabs.EditableContent",
  "Tabs/Content/Editable",
  (root) => {
    root.contentSlot = {
      id: "content",
      name: "Content",
      description:
        "Compose this tab's panel. Pair it with a corresponding trigger.",
    };
    return root;
  },
);
const tabs = derived(
  tabsSource,
  "components/Tabs.Editable",
  "Tabs/Editable",
  (root, props) => {
    const list = root.children.find((n) => n.id === "tab-list");
    list.contentSlot = {
      id: "triggers",
      name: "Triggers",
      minChildren: 1,
      description:
        "Add linked Tabs Trigger instances. Use Add tab pair to append a trigger and panel together.",
    };
    list.children = ["overview", "assets"].map((activeTab, i) =>
      reference(
        "trigger-" + i,
        tabsTrigger,
        {
          variant: props.variant,
          size: props.size,
          disabled: "false",
          selected: i === 0,
        },
        { text: i ? "Assets" : "Overview" },
      ),
    );
    const content = root.children.find((n) => n.id === "content");
    content.contentSlot = {
      id: "panels",
      name: "Panels",
      minChildren: 1,
      description:
        "Keep one linked panel per trigger in matching order. Use Select tab pair to show one panel.",
    };
    content.children = [0, 1].map((i) =>
      reference(
        "panel-" + i,
        tabsPanel,
        { padding: props.padding },
        { visible: i === 0 },
      ),
    );
    return root;
  },
  [
    "Triggers and panels are paired by position. Add/select actions validate equal counts before changing them. Direct native editing remains available; keyboard and runtime tab behavior remain in code.",
  ],
);
out.push(tabsTrigger, tabsPanel, tabs);
export default out;
