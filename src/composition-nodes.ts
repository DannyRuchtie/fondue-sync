import { read } from "./metadata";
type Node = any;
export async function sourceId(instance: Node): Promise<string | null> {
  if (instance?.type !== "INSTANCE") return null;
  const main = await instance.getMainComponentAsync();
  const owner = main?.parent?.type === "COMPONENT_SET" ? main.parent : main;
  if (!owner) return null;
  try {
    return (
      JSON.parse(read(owner, "mapping")).id?.replace(/^recipe:/, "") ?? null
    );
  } catch {
    return null;
  }
}
export async function ancestor(node: Node, id: string): Promise<Node> {
  for (
    let current = node;
    current && current.type !== "PAGE";
    current = current.parent
  )
    if ((await sourceId(current)) === id) return current;
  throw Error(
    "Select a linked " +
      id.split("/").pop() +
      " composition, or content inside it.",
  );
}
export function slot(node: Node, name?: string): Node {
  const found: Node[] = [];
  const visit = (current: Node, root = false) => {
    if (current.type === "SLOT") {
      if (!name || current.name === name) found.push(current);
      return;
    }
    if (!root && current.type === "INSTANCE") return;
    for (const child of current.children ?? []) visit(child);
  };
  visit(node, true);
  if (found.length !== 1)
    throw Error(
      "Expected one native " +
        (name ?? "content") +
        " slot. Choose an editable composition.",
    );
  return found[0];
}
export function oneSelection(api: PluginAPI): Node {
  if (api.currentPage.selection.length !== 1)
    throw Error("Select one component or cell first.");
  return api.currentPage.selection[0];
}
export async function loadFonts(api: PluginAPI, node: Node) {
  const texts = node.findAllWithCriteria({ types: ["TEXT"] });
  for (const text of texts)
    for (const segment of text.getStyledTextSegments(["fontName"]))
      await api.loadFontAsync(segment.fontName);
}
export async function label(api: PluginAPI, node: Node, value: string) {
  await loadFonts(api, node);
  const property = Object.entries(node.componentProperties ?? {}).find(
    ([, prop]: any) => prop.type === "TEXT",
  );
  if (property) node.setProperties({ [property[0]]: value });
  else {
    const text = node.findAllWithCriteria({ types: ["TEXT"] })[0];
    if (text) text.characters = value;
  }
}
export function width(node: Node, next: number) {
  const vertical = node.layoutSizingVertical;
  node.resize(next, node.height);
  if (vertical === "HUG") node.layoutSizingVertical = "HUG";
}

export async function freshInstance(
  api: PluginAPI,
  template: Node,
  text?: string,
) {
  const main =
    template.type === "COMPONENT"
      ? template
      : await template.getMainComponentAsync();
  if (!main || main.type !== "COMPONENT")
    throw Error("Linked component template is missing.");
  await loadFonts(api, main);
  const node = main.createInstance();
  try {
    if (template.type === "INSTANCE") {
      const props = Object.fromEntries(
        Object.entries(template.componentProperties ?? {})
          .filter(([, p]: any) => p.type === "VARIANT")
          .map(([key, p]: any) => [key, p.value]),
      );
      if (Object.keys(props).length) node.setProperties(props);
    }
    if (text !== undefined) await label(api, node, text);
    return node;
  } catch (error) {
    node.remove();
    throw error;
  }
}
