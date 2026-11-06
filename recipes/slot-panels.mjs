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

const button = controls.find(
  (r) =>
    r.name.startsWith("Button/") &&
    r.variants.some(
      (v) =>
        v.props.variant === "default" &&
        v.props.emphasis === "default" &&
        v.props.state === "default",
    ),
);
const input =
  controls.find((r) => r.name.startsWith("TextInput/")) ??
  patterns.find((r) => r.name === "TextInput");
const actions = () => [
  reference(
    "cancel",
    button,
    { variant: "default", emphasis: "default", state: "default" },
    { text: "Cancel" },
  ),
  reference(
    "confirm",
    button,
    { variant: "default", emphasis: "default", state: "default" },
    { text: "Continue" },
  ),
];
const out = [];
for (const family of ["Flyout", "Dialog"]) {
  const prefix = "components/" + family;
  const bodySource = find(patterns, prefix + ".Body");
  const body = derived(
    bodySource,
    prefix + ".EditableBody",
    family + "/Body/Editable",
    (root) => {
      delete root.height;
      root.contentSlot = {
        id: "body",
        name: "Body",
        description:
          "Place forms, text, lists or linked components in the body. Padding stays library-owned.",
      };
      root.children = root.children.map((child) =>
        child.id === "name"
          ? reference(
              "field",
              input,
              {},
              { width: family === "Flyout" ? 288 : 368 },
            )
          : child,
      );
      return root;
    },
  );
  const footer = derived(
    find(patterns, prefix + ".Footer"),
    prefix + ".EditableFooter",
    family + "/Footer/Editable",
    (root) => {
      delete root.height;
      const content = root.children.find((child) => child.id === "actions");
      delete content.height;
      content.contentSlot = {
        id: "actions",
        name: "Actions",
        description:
          "Insert and reorder linked actions. Footer padding, divider and right alignment remain shared.",
      };
      content.children = actions();
      return root;
    },
  );
  const source = find(patterns, prefix);
  const editable = derived(
    source,
    prefix + ".Editable",
    family + "/Editable",
    (root, props) => {
      // Keep the original header geometry and close control in the owning main.
      const originalBody = root.children.find((child) => child.id === "body");
      const originalFooter = root.children.find(
        (child) => child.id === "footer",
      );
      delete originalFooter.height;
      originalBody.contentSlot = {
        id: "body",
        name: "Body",
        description:
          "Replace this example with your own form, list or linked components.",
      };
      originalBody.children = body.variants
        .find((v) => v.props.padding === props.padding)
        .root.children.map(clone);
      const content = originalFooter.children.find(
        (child) => child.id === "actions",
      );
      delete content.height;
      content.contentSlot = {
        id: "actions",
        name: "Actions",
        description: "Add or reorder linked footer actions.",
      };
      content.children = actions();
      return root;
    },
    [
      "Body and actions are independent native slots. Header and dismissal controls remain library-owned. Anchoring, scrolling, focus and interaction remain runtime.",
    ],
  );
  if (family === "Dialog") {
    editable.variants = editable.variants.flatMap((v) =>
      [false, true].map((sideContent) => {
        const root = clone(v.root);
        const main = frame("main", root.children, { width: root.width });
        root.layout = "HORIZONTAL";
        root.width += sideContent ? 160 : 0;
        root.children = [
          region("side-content", "Side content", [], {
            width: 160,
            visible: sideContent,
          }),
          main,
        ];
        return variant({ ...v.props, sideContent }, root);
      }),
    );
  }
  out.push(body, footer, editable);
}
export default out;
