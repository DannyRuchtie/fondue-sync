import { read, write } from "./metadata";
export type PresentationIndex = {
  assets: Record<string, { id: string; kind: string }>;
  pages: Record<string, string>;
  presentationNodes?: Record<string, string>;
  presentationInstances?: Record<string, string>;
};
type NativePresentationNodes = {
  FRAME: FrameNode;
  TEXT: TextNode;
  RECTANGLE: RectangleNode;
};
export class Presentation {
  api: PluginAPI;
  index: PresentationIndex;
  save: () => void;
  warnings: string[] = [];
  variables = new Map<string, Variable>();
  styles = new Map<string, TextStyle>();
  nodes = new Map<string, SceneNode>();
  mutated = new Set<string>();
  created = new Set<string>();
  constructor(api: PluginAPI, index: PresentationIndex, save: () => void) {
    this.api = api;
    this.index = index;
    this.save = save;
  }
  async variable(id: string, type: VariableResolvedDataType) {
    if (this.variables.has(id)) return this.variables.get(id)!;
    const ref = this.index.assets["token:" + id];
    if (!ref || ref.kind !== "token")
      throw Error("Missing exact presentation token " + id);
    const variable = await this.api.variables.getVariableByIdAsync(ref.id);
    if (!variable || variable.resolvedType !== type)
      throw Error("Wrong/missing presentation variable " + id);
    this.variables.set(id, variable);
    return variable;
  }
  async style(id: string) {
    if (this.styles.has(id)) return this.styles.get(id)!;
    const ref = this.index.assets["style:" + id];
    if (!ref || ref.kind !== "style")
      throw Error("Missing exact presentation style " + id);
    const style = await this.api.getStyleByIdAsync(ref.id);
    if (!style || style.type !== "TEXT")
      throw Error("Wrong/missing native presentation style " + id);
    if (!["Diatype", "ABC Diatype", "Cranny"].includes(style.fontName.family))
      throw Error(
        "Required presentation font is not ready: " +
          id +
          " / " +
          style.fontName.family,
      );
    await this.api.loadFontAsync(style.fontName);
    this.styles.set(id, style);
    return style;
  }
  number(id: string) {
    const variable = this.variables.get(id);
    if (!variable) throw Error("Presentation number not preflighted " + id);
    const value = Object.values(variable.valuesByMode).find(
      (v) => typeof v === "number",
    );
    if (typeof value !== "number") throw Error("Expected source scalar " + id);
    return value;
  }
  async preflight() {
    await Promise.all(
      [
        "color-surface-default",
        "color-surface-dim",
        "color-primary-default",
        "color-secondary-default",
        "color-line-subtle",
      ].map((id) => this.variable(id, "COLOR")),
    );
    await Promise.all(
      [
        "spacing-xx-small",
        "spacing-x-small",
        "spacing-small",
        "spacing-medium",
        "spacing-large",
        "spacing-x-large",
        "spacing-xx-large",
        "border-radius-medium",
        "border-radius-large",
        "border-width-default",
        "border-width-large",
        "component-constant-spacing-0",
      ].map((id) => this.variable(id, "FLOAT")),
    );
    for (const id of [
      "text-heading-xx-large-default",
      "text-heading-x-large-default",
      "text-body-medium-default",
      "text-body-medium-strong",
      "text-body-small-default",
      "text-body-x-small-default",
      "text-body-x-small-strong",
    ])
      await this.style(id);
  }
  async page(key: string) {
    const ref = this.index.pages[key];
    let page = ref ? await this.api.getNodeByIdAsync(ref) : null;
    if (ref && (!page || page.type !== "PAGE"))
      throw Error("Presentation page identity missing/changed " + key);
    if (!page) {
      page = this.api.createPage();
      page.name = "Fondue / " + key;
      this.index.pages[key] = page.id;
      this.save();
      this.created.add(page.id);
      this.mutated.add(page.id);
    }
    if ("loadAsync" in page) await page.loadAsync();
    return page as PageNode;
  }
  async node<T extends keyof NativePresentationNodes>(
    key: string,
    type: T,
    parent: ChildrenMixin & BaseNode,
  ): Promise<NativePresentationNodes[T]> {
    this.index.presentationNodes ??= {};
    const ref = this.index.presentationNodes[key];
    let node = ref ? await this.api.getNodeByIdAsync(ref) : null;
    if (ref && (!node || node.type !== type))
      throw Error(
        "Presentation identity missing/changed " + key + " (" + ref + ")",
      );
    if (!node) {
      node =
        type === "FRAME"
          ? this.api.createFrame()
          : type === "TEXT"
            ? this.api.createText()
            : this.api.createRectangle();
      parent.appendChild(node as SceneNode);
      this.index.presentationNodes[key] = node.id;
      this.save();
      this.created.add(node.id);
      write(node, "presentation-key", key);
      write(node, "presentation-type", type);
    } else if (node.parent?.id !== parent.id)
      parent.appendChild(node as SceneNode);
    this.nodes.set(key, node as SceneNode);
    this.mutated.add(node.id);
    return node as NativePresentationNodes[T];
  }
  paint(node: any, field: "fills" | "strokes", id: string) {
    const v = this.variables.get(id);
    if (!v) throw Error("Paint not preflighted " + id);
    // Rebinding the same alias can retain the supplied literal in native Figma.
    // Seed it with this exact variable resolved in the consumer's explicit mode.
    const resolved = v.resolveForConsumer(node);
    if (resolved.resolvedType !== "COLOR")
      throw Error("Presentation paint did not resolve to COLOR " + id);
    const color = resolved.value as RGB | RGBA;
    node[field] = [
      this.api.variables.setBoundVariableForPaint(
        {
          type: "SOLID",
          color: { r: color.r, g: color.g, b: color.b },
          opacity: "a" in color ? color.a : 1,
        },
        "color",
        v,
      ),
    ];
  }
  bind(node: any, field: string, id: string) {
    const v = this.variables.get(id);
    if (!v) throw Error("Scalar not preflighted " + id);
    node.setBoundVariable(field, v);
  }
  auto(
    node: FrameNode,
    direction: "HORIZONTAL" | "VERTICAL",
    padding = "component-constant-spacing-0",
    gap = "spacing-medium",
  ) {
    node.layoutMode = direction;
    node.layoutWrap = "NO_WRAP";
    node.primaryAxisSizingMode = "AUTO";
    node.counterAxisSizingMode = "AUTO";
    node.counterAxisAlignItems = "MIN";
    node.primaryAxisAlignItems = "MIN";
    for (const field of [
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
    ])
      this.bind(node, field, padding);
    this.bind(node, "itemSpacing", gap);
  }
  wrap(node: FrameNode, width: number, gap = "spacing-large") {
    this.auto(node, "HORIZONTAL", "component-constant-spacing-0", gap);
    node.layoutWrap = "WRAP";
    this.bind(node, "counterAxisSpacing", gap);
    node.counterAxisAlignContent = "AUTO";
    // Native Figma keeps a HUG primary axis at its content width during resize.
    // Fix the horizontal axis first so wrapping receives the requested width.
    node.primaryAxisSizingMode = "FIXED";
    node.resizeWithoutConstraints(width, Math.max(1, node.height));
    node.primaryAxisSizingMode = "FIXED";
    node.counterAxisSizingMode = "AUTO";
  }
  async frame(
    key: string,
    parent: ChildrenMixin & BaseNode,
    name = "",
    theme: "surface" | "card" | "none" = "none",
  ) {
    const node = await this.node(key, "FRAME", parent);
    node.name = name;
    node.layoutMode = "NONE";
    node.clipsContent = false;
    node.fills = [];
    node.strokes = [];
    if (theme !== "none")
      this.paint(
        node,
        "fills",
        theme === "card" ? "color-surface-dim" : "color-surface-default",
      );
    if (theme === "card") {
      this.paint(node, "strokes", "color-line-subtle");
      this.bind(node, "strokeWeight", "border-width-default");
      this.bind(node, "cornerRadius", "border-radius-large");
    }
    return node as FrameNode;
  }
  async text(
    key: string,
    parent: ChildrenMixin & BaseNode,
    content: string,
    styleId: string,
    color = "color-primary-default",
    width = 400,
  ) {
    const style = await this.style(styleId);
    const node = await this.node(key, "TEXT", parent);
    node.name = "";
    const baseline = read(node, "presentation-text");
    if (baseline && node.characters !== baseline) {
      this.warnings.push("Preserved local presentation text " + key);
    } else {
      await node.setTextStyleIdAsync(style.id);
      node.characters = content;
      write(node, "presentation-text", content);
    }
    // No literal font/size/line-height setter after the shared style assignment.
    node.textAutoResize = "HEIGHT";
    node.resize(width, Math.max(1, node.height));
    this.paint(node, "fills", color);
    return node as TextNode;
  }
  async instance(
    key: string,
    parent: ChildrenMixin & BaseNode,
    main: ComponentNode,
  ) {
    this.index.presentationInstances ??= {};
    const ref = this.index.presentationInstances[key];
    let node = ref ? await this.api.getNodeByIdAsync(ref) : null;
    if (ref && (!node || node.type !== "INSTANCE"))
      throw Error("Presentation instance identity missing/changed " + key);
    if (!node) {
      node = main.createInstance();
      parent.appendChild(node as InstanceNode);
      this.index.presentationInstances[key] = node.id;
      this.save();
      const collect = (child: SceneNode) => {
        this.created.add(child.id);
        if ("children" in child)
          for (const nested of child.children) collect(nested);
      };
      collect(node as SceneNode);
      write(node, "presentation-source-main", main.id);
    } else if (node.parent?.id !== parent.id)
      parent.appendChild(node as InstanceNode);
    node.name = "";
    this.mutated.add(node.id);
    return node as InstanceNode;
  }
  position(node: SceneNode, x: number, y: number) {
    node.x = x;
    node.y = y;
    this.mutated.add(node.id);
  }
  size(node: SceneNode, width: number, height: number) {
    if ("resizeWithoutConstraints" in node)
      node.resizeWithoutConstraints(width, height);
    else if ("resize" in node) node.resize(width, height);
    this.mutated.add(node.id);
  }
}
