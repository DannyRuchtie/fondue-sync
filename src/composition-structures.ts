import {
  ancestor,
  sourceId,
  slot,
  oneSelection,
  freshInstance,
  width,
} from "./composition-nodes";
type Node = any;
const ids = {
  radio: "components/RadioList.Editable",
  option: "components/RadioList.EditableOption",
  tabs: "components/Tabs.Editable",
  trigger: "components/Tabs.EditableTrigger",
  panel: "components/Tabs.EditableContent",
  tree: "components/Tree.Editable",
  node: "components/Tree.EditableNode",
  grid: "components/Grid.Editable",
  row: "components/Grid.EditableRow",
  cell: "components/Grid.EditableCell",
};
const known = new Set([
  "add-radio",
  "select-radio",
  "add-tab-pair",
  "select-tab-pair",
  "add-tree-child",
  "add-tree-sibling",
  "add-grid-cell",
  "reflow-grid",
]);
async function checkChildren(region: Node, id: string) {
  for (const child of region.children)
    if ((await sourceId(child)) !== id)
      throw Error(
        "This region contains an incompatible component. Preserve it and repair the composition before using this action.",
      );
  return [...region.children] as Node[];
}
function contains(root: Node, selected: Node): boolean {
  for (let node = selected; node; node = node.parent)
    if (node.id === root.id) return true;
  return false;
}
/** Consumer-only edits. Validate complete structures before changing their existing content. */
export async function composeStructure(api: PluginAPI, action: string) {
  if (!known.has(action)) return undefined;
  const selected = oneSelection(api);
  const created: string[] = [],
    mutated: string[] = [],
    removed: string[] = [];
  let message = "";
  if (action.endsWith("radio")) {
    const root = await ancestor(selected, ids.radio);
    const region = slot(root, "Options");
    const items = await checkChildren(region, ids.option);
    if (action === "select-radio") {
      const target = await ancestor(selected, ids.option);
      if (!items.some((n) => n.id === target.id))
        throw Error("Select an option directly inside this radio list.");
      for (const item of items) {
        item.setProperties({ selected: String(item.id === target.id) });
        mutated.push(item.id);
      }
      message = "Selected one radio option and cleared the others.";
    } else {
      const template =
        items[0] ??
        slot(await root.getMainComponentAsync(), "Options").children[0];
      if (!template) throw Error("No linked option template is available.");
      const item = await freshInstance(
        api,
        template,
        "Option " + (items.length + 1),
      );
      try {
        item.setProperties({ selected: String(items.length === 0) });
        region.appendChild(item);
      } catch (error) {
        item.remove();
        throw error;
      }
      created.push(item.id);
      message = "Added a linked radio option.";
    }
    mutated.push(root.id);
  } else if (action.includes("tab-pair")) {
    const root = await ancestor(selected, ids.tabs),
      triggersRegion = slot(root, "Triggers"),
      panelsRegion = slot(root, "Panels");
    const triggers = await checkChildren(triggersRegion, ids.trigger),
      panels = await checkChildren(panelsRegion, ids.panel);
    if (!triggers.length || triggers.length !== panels.length)
      throw Error(
        "Tabs need one linked panel per trigger in the same order. Restore matching pairs first.",
      );
    if (action === "add-tab-pair") {
      const prepared: Node[] = [];
      try {
        const trigger = await freshInstance(
          api,
          triggers[0],
          "Tab " + (triggers.length + 1),
        );
        prepared.push(trigger);
        const panel = await freshInstance(
          api,
          panels[0],
          "Tab " + (panels.length + 1) + " content",
        );
        prepared.push(panel);
        trigger.setProperties({ selected: "false" });
        panel.visible = false;
        triggersRegion.appendChild(trigger);
        panelsRegion.appendChild(panel);
        created.push(trigger.id, panel.id);
      } catch (error) {
        for (const part of prepared) part.remove();
        throw error;
      }
      message = "Added a linked trigger and its matching panel.";
    } else {
      const index = triggers.findIndex(
        (trigger, i) =>
          contains(trigger, selected) || contains(panels[i], selected),
      );
      if (index < 0) throw Error("Select a trigger or its panel first.");
      triggers.forEach((trigger, i) => {
        trigger.setProperties({ selected: String(i === index) });
        panels[i].visible = i === index;
        mutated.push(trigger.id, panels[i].id);
      });
      message = "Selected the tab and showed only its matching panel.";
    }
    mutated.push(root.id);
  } else if (action.startsWith("add-tree-")) {
    const node = await ancestor(selected, ids.node);
    const region =
      action === "add-tree-child" ? slot(node, "Children") : node.parent;
    if (region?.type !== "SLOT" || !["Nodes", "Children"].includes(region.name))
      throw Error("Select a node inside a Tree Nodes or Children slot.");
    await checkChildren(region, ids.node);
    const item = await freshInstance(api, node, "New node");
    try {
      item.setProperties({
        isExpanded: "false",
        isSelected: "false",
        isDisabled: "false",
      });
      region.appendChild(item);
      item.layoutSizingHorizontal = "FILL";
      if (action === "add-tree-child") {
        node.setProperties({ isExpanded: "true" });
        mutated.push(node.id);
      }
      created.push(item.id);
    } catch (error) {
      item.remove();
      throw error;
    }
    message =
      action === "add-tree-child"
        ? "Added a linked child node and expanded its parent."
        : "Added a linked sibling node.";
    mutated.push(region.id);
  } else {
    const root = await ancestor(selected, ids.grid),
      region = slot(root, "Rows");
    const rows = await checkChildren(region, ids.row);
    const cells: Node[] = [];
    for (const row of rows)
      cells.push(...(await checkChildren(slot(row, "Cells"), ids.cell)));
    const columns = Number(root.componentProperties.columns?.value);
    if (!Number.isInteger(columns) || columns < 1 || columns > 4)
      throw Error("Choose one to four grid columns first.");
    const cellWidth = root.width / columns;
    if (!Number.isFinite(cellWidth) || cellWidth < 32)
      throw Error("Increase the grid width so each column has at least 32px.");
    const defaults = slot(await root.getMainComponentAsync(), "Rows");
    const rowTemplate = rows[0] ?? defaults.children[0];
    if (!rowTemplate) throw Error("No linked grid row template is available.");
    const prepared: Node[] = [];
    try {
      if (action === "add-grid-cell") {
        const cellTemplate =
          cells[0] ??
          slot(await rowTemplate.getMainComponentAsync(), "Cells").children[0];
        if (!cellTemplate)
          throw Error("No linked grid cell template is available.");
        const cell = await freshInstance(
          api,
          cellTemplate,
          "Item " + (cells.length + 1),
        );
        prepared.push(cell);
        cells.push(cell);
        created.push(cell.id);
      }
      const needed = Math.max(1, Math.ceil(cells.length / columns));
      while (rows.length < needed) {
        const row = await freshInstance(api, rowTemplate);
        prepared.push(row);
        while (slot(row, "Cells").children.length)
          slot(row, "Cells").children[0].remove();
        rows.push(row);
        created.push(row.id);
      }
    } catch (error) {
      for (const item of prepared) item.remove();
      throw error;
    }
    // Instance-slot edits can materialize defaults and rebase descendant IDs.
    // Resolve each source/destination again by position after every mutation.
    // The model tracks ordering only; content is always moved, never rebuilt.
    const needed = Math.max(1, Math.ceil(cells.length / columns));
    const liveRows = () => [...slot(root, "Rows").children] as Node[];
    for (const row of prepared.filter((part) => !cells.includes(part)))
      slot(root, "Rows").appendChild(row);
    const addedCell = prepared.find((part) => cells.includes(part));
    if (addedCell) slot(liveRows().at(-1), "Cells").appendChild(addedCell);
    let token = 0;
    const model = liveRows().map((row) =>
      slot(row, "Cells").children.map(() => token++),
    );
    const liveCell = (r: number, c: number) =>
      slot(liveRows()[r], "Cells").children[c];
    for (let i = 0; i < token; i++) {
      const destinationRow = Math.floor(i / columns),
        destinationColumn = i % columns;
      const sourceRow = model.findIndex((row) => row.includes(i));
      const sourceColumn = model[sourceRow].indexOf(i);
      width(liveCell(sourceRow, sourceColumn), cellWidth);
      if (sourceRow !== destinationRow || sourceColumn !== destinationColumn) {
        const cell = liveCell(sourceRow, sourceColumn);
        slot(liveRows()[destinationRow], "Cells").insertChild(
          destinationColumn,
          cell,
        );
        model[sourceRow].splice(sourceColumn, 1);
        model[destinationRow].splice(destinationColumn, 0, i);
      }
    }
    for (let i = 0; i < needed; i++) width(liveRows()[i], root.width);
    for (let i = liveRows().length - 1; i >= needed; i--) {
      const row = liveRows()[i];
      if (slot(row, "Cells").children.length)
        throw Error("An extra row still has content; it was preserved.");
      removed.push(row.id);
      row.remove();
    }
    mutated.push(
      ...liveRows().flatMap((row) => [
        row.id,
        ...slot(row, "Cells").children.map((cell: Node) => cell.id),
      ]),
    );
    mutated.push(root.id);
    message =
      action === "add-grid-cell"
        ? "Added a linked grid cell and packed rows using the chosen column count."
        : "Reflowed the existing linked cells without replacing their content.";
  }
  return {
    createdNodeIds: created,
    mutatedNodeIds: [...new Set(mutated)],
    removedNodeIds: removed,
    message,
  };
}
