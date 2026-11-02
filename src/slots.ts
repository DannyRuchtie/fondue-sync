import type { Layer } from "./schema";
import { read, write } from "./metadata";

const slotIdentity = (definition: Layer) =>
  "$slot:" + definition.contentSlot!.id;

/** Logical child identities are independent of the native slot wrapper. */
export function contentContainer(node: any, definition: Layer): any {
  if (!definition.contentSlot) return node;
  const matches = (node.children ?? []).filter(
    (child: any) => read(child, "identity") === slotIdentity(definition),
  );
  if (matches.length > 1) throw Error("Duplicate managed content slot");
  if (matches.length && node.children.length !== 1)
    throw Error("Unexpected sibling beside managed content slot");
  return matches[0] ?? node;
}

/** Defaults belong to the main; instance contents are never reset by this helper. */
export async function ensureContentSlot(
  api: PluginAPI,
  node: any,
  definition: Layer,
  owner: any,
): Promise<any> {
  const spec = definition.contentSlot;
  if (!spec) return node;
  if (!owner || definition.kind !== "frame" || node.type === "INSTANCE")
    throw Error("Content slots require a library-owned frame in a component");
  const definitions = owner.componentPropertyDefinitions;
  let key = Object.keys(definitions).find(
    (key) => key.split("#")[0] === spec.name,
  );
  if (key && definitions[key].type !== "SLOT")
    throw Error(
      "Content slot property collides with another property: " + spec.name,
    );
  let slot = contentContainer(node, definition);
  if (slot === node) {
    if (node.children.length)
      throw Error(
        "Existing content requires explicit slot migration; overrides must be preserved",
      );
    let component = node;
    while (component && component.type !== "COMPONENT")
      component = component.parent;
    if (!component || typeof component.createSlot !== "function")
      throw Error("This Figma version does not support native slots");
    slot = component.createSlot();
    node.appendChild(slot);
    write(slot, "identity", slotIdentity(definition));
  }
  if (slot.type !== "SLOT")
    throw Error("Managed content region is not a native slot");
  const generatedKey = slot.componentPropertyReferences.slotContentId;
  if (!key) {
    key = owner.editComponentProperty(generatedKey, { name: spec.name });
  } else if (generatedKey !== key) {
    slot.componentPropertyReferences = { slotContentId: key };
    // createSlot supplies a fresh property; discard only that now-unused property.
    owner.deleteComponentProperty(generatedKey);
  }
  owner.editComponentProperty(key, {
    description: spec.description ?? "",
    slotSettings: {
      displayEmptyByDefault: true,
      stretchChildOnInsert: true,
      minChildren: spec.minChildren ?? null,
      maxChildren: spec.maxChildren ?? null,
    },
  });
  slot.name = spec.name;
  slot.layoutMode = definition.layout ?? "VERTICAL";
  slot.primaryAxisSizingMode = "AUTO";
  slot.counterAxisSizingMode = "AUTO";
  slot.itemSpacing = definition.gap ?? 0;
  slot.primaryAxisAlignItems =
    definition.primaryAlign ?? definition.primaryAxisAlignItems ?? "MIN";
  const cross =
    definition.counterAlign ?? definition.counterAxisAlignItems ?? "CENTER";
  slot.counterAxisAlignItems =
    cross === "BASELINE" && slot.layoutMode === "VERTICAL" ? "MIN" : cross;
  slot.fills = [];
  slot.clipsContent = false;
  slot.layoutSizingHorizontal = definition.width !== undefined ? "FILL" : "HUG";
  slot.layoutSizingVertical = "HUG";
  return slot;
}
