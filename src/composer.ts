import { read } from "./metadata";
import {
  ancestor,
  sourceId,
  slot,
  oneSelection,
  loadFonts,
  label,
  width,
} from "./composition-nodes";
import { composeStructure } from "./composition-structures";
import policies from "../recipes/composition-policies.json";

type Node = any;
const IDs = {
  segments: "components/SegmentedControl.Root",
  item: "components/SegmentedControl.Item",
  table: "components/Table.Root",
  row: "components/Table.EditableRow",
  cell: "components/Table.ContentCell",
  header: "components/Table.HeaderCell",
  contentHeader: "components/Table.ContentHeaderCell",
};
async function cellWidth(cell: Node, next: number) {
  const main = await cell.getMainComponentAsync();
  const sourceWidth = main.width;
  const visit = (node: Node, root = false) => {
    if (node.type === "SLOT" || (!root && node.type === "INSTANCE")) return;
    if (
      root ||
      (["FRAME", "RECTANGLE"].includes(node.type) &&
        node.layoutSizingHorizontal !== "FILL" &&
        Math.abs(node.width - sourceWidth) < 0.5)
    )
      width(node, next);
    for (const child of node.children ?? []) visit(child);
  };
  visit(cell, true);
}
async function readTable(api: PluginAPI) {
  const selected = oneSelection(api);
  const root = await ancestor(selected, IDs.table);
  const rows = [...slot(root).children];
  if (!rows.length) throw Error("Add an EditableRow to the Rows slot first.");
  const cells: Node[][] = [];
  for (const row of rows) {
    if ((await sourceId(row)) !== IDs.row)
      throw Error(
        "The Rows slot contains a non-row component. Preserve it and use native editing or move it outside the table.",
      );
    const parts = [...slot(row).children];
    if (!parts.length) throw Error("Each row needs at least one cell.");
    for (const part of parts)
      if (
        ![IDs.cell, IDs.header, IDs.contentHeader].includes(
          (await sourceId(part))!,
        )
      )
        throw Error(
          "A Cells slot contains an unrecognized cell. Native content inside a ContentCell is supported.",
        );
    cells.push(parts);
  }
  if (cells.some((row) => row.length !== cells[0].length))
    throw Error(
      "Rows have different cell counts. Restore a rectangular table before adding rows or columns.",
    );
  return { root, rows, cells, selected };
}
function aligned(cells: Node[][]) {
  if (
    cells.some((row) =>
      row.some((cell, i) => Math.abs(cell.width - cells[0][i].width) > 0.5),
    )
  )
    throw Error(
      "Column widths differ. Select the intended cell width and use Match column width first.",
    );
}
async function layoutTable(root: Node, rows: Node[], cells: Node[][]) {
  const total = cells[0].reduce((n, cell) => n + cell.width, 0);
  width(root, total);
  for (const row of rows) {
    width(row, total);
    row.layoutSizingHorizontal = "FILL";
  }
}
/** Explicit composition edits affect only selected consumer content, never library mains. */
export async function compose(
  api: PluginAPI,
  assets: Record<string, { id: string }>,
  action: string,
  amount = 5,
  recipeId?: string,
) {
  const skipHidden = api.skipInvisibleInstanceChildren;
  api.skipInvisibleInstanceChildren = false;
  try {
    return await composeWithSlotContent(api, assets, action, amount, recipeId);
  } finally {
    api.skipInvisibleInstanceChildren = skipHidden;
  }
}
async function composeWithSlotContent(
  api: PluginAPI,
  assets: Record<string, { id: string }>,
  action: string,
  amount = 5,
  recipeId?: string,
) {
  const structured = await composeStructure(api, action);
  if (structured) return structured;
  const changed: string[] = [];
  const created: string[] = [];
  if (
    action === "insert-segments" ||
    action === "insert-table" ||
    action === "insert-family"
  ) {
    if (
      (action === "insert-segments" ||
        (action === "insert-family" && recipeId === IDs.segments)) &&
      (!Number.isInteger(amount) || amount < 2 || amount > 10)
    )
      throw Error("Choose between two and ten segments.");
    const family = Object.values(policies.families).find(
      (policy: any) => policy.entryRecipeId === recipeId,
    ) as any;
    if (action === "insert-family" && !family)
      throw Error(
        "Choose an editable component from the composition checklist.",
      );
    const id =
      action === "insert-family"
        ? recipeId!
        : action === "insert-table"
          ? IDs.table
          : IDs.segments;
    const set = assets["recipe:" + id]
      ? await api.getNodeByIdAsync(assets["recipe:" + id].id)
      : null;
    if (!set || set.type !== "COMPONENT_SET")
      throw Error(
        "Choose Install missing editable components in Compose with slots first.",
      );
    const preferred =
      action === "insert-family"
        ? set.children.find((node: Node) => {
            let props;
            try {
              props = JSON.parse(read(node, "variant-props"));
            } catch {
              return false;
            }
            return Object.entries(family.entryProps ?? {}).every(
              ([key, value]) => props[key] === value,
            );
          })
        : undefined;
    const main =
      preferred ||
      (action === "insert-table" &&
        set.children.find((main: Node) =>
          main.name.includes("composition=custom-header"),
        )) ||
      (set.children.find(
        (main: Node) =>
          action === "insert-table" || main.name.includes("hugWidth=true"),
      ) as ComponentNode);
    if (!main || main.type !== "COMPONENT")
      throw Error(
        "Composition main is missing. Choose Install missing editable components first.",
      );
    await loadFonts(api, main);
    const right = Math.max(
      0,
      ...api.currentPage.children.map((n) => n.x + n.width),
    );
    const instance = main.createInstance();
    api.currentPage.appendChild(instance);
    instance.x = right + 160;
    instance.y = 0;
    created.push(instance.id);
    api.currentPage.selection = [instance];
    if (id === IDs.segments)
      for (let i = 2; i < amount; i++) {
        const added = await appendSegment(api, instance);
        created.push(added.id);
      }
    api.viewport.scrollAndZoomIntoView([instance]);
    return {
      createdNodeIds: created,
      mutatedNodeIds: [],
      message:
        action === "insert-family"
          ? "Inserted a linked editable composition. Use its named slots to change content."
          : action === "insert-table"
            ? "Inserted a linked table with three columns and three body rows."
            : "Inserted a linked control with " + amount + " segments.",
    };
  }
  if (action === "add-segment" || action === "select-segment") {
    const selected = oneSelection(api);
    const root = await ancestor(selected, IDs.segments);
    if (action === "add-segment")
      created.push((await appendSegment(api, root)).id);
    else {
      const item = await ancestor(selected, IDs.item);
      for (const child of slot(root).children) {
        if ((await sourceId(child)) !== IDs.item)
          throw Error("Segments contains an unrecognized item.");
      }
      for (const child of slot(root).children) {
        child.setProperties({ selected: String(child.id === item.id) });
        changed.push(child.id);
      }
    }
    changed.push(root.id);
    return {
      createdNodeIds: created,
      mutatedNodeIds: changed,
      message:
        action === "add-segment"
          ? "Added a linked segment."
          : "Selected one segment and cleared the others.",
    };
  }
  const table = await readTable(api);
  if (action === "match-column-width") {
    const column = table.cells
      .find((row) =>
        row.some(
          (cell) =>
            cell === table.selected ||
            cell.findAll(() => true).some((n: Node) => n === table.selected),
        ),
      )
      ?.findIndex(
        (cell) =>
          cell === table.selected ||
          cell.findAll(() => true).some((n: Node) => n === table.selected),
      );
    if (column === undefined || column < 0)
      throw Error(
        "Select a cell or a layer inside the column whose width you want to use.",
      );
    const selectedCell = table.cells
      .flat()
      .find(
        (cell) =>
          cell === table.selected ||
          cell.findAll(() => true).some((n: Node) => n === table.selected),
      );
    const next = selectedCell.width;
    if (!Number.isFinite(next) || next < 32)
      throw Error("Column width must be at least 32px.");
    for (const row of table.cells) {
      await cellWidth(row[column], next);
      changed.push(row[column].id);
    }
    await layoutTable(table.root, table.rows, table.cells);
  } else if (action === "add-column") {
    aligned(table.cells);
    const additions: Node[] = [];
    try {
      for (const row of table.cells) {
        const main = await row[row.length - 1].getMainComponentAsync();
        await loadFonts(api, main);
        const cell = main.createInstance();
        additions.push(cell);
        created.push(cell.id);
        await label(api, cell, "Column " + (row.length + 1));
        await cellWidth(cell, row[row.length - 1].width);
      }
    } catch (error) {
      for (const cell of additions) cell.remove();
      throw error;
    }
    additions.forEach((cell, i) => {
      slot(table.rows[i]).appendChild(cell);
      table.cells[i].push(cell);
    });
    await layoutTable(table.root, table.rows, table.cells);
  } else if (action === "add-row") {
    aligned(table.cells);
    const template = table.rows.find(
      (row) => row.componentProperties.section?.value === "body",
    );
    if (!template) throw Error("Add a body EditableRow before using Add row.");
    const main = await template.getMainComponentAsync();
    await loadFonts(api, main);
    const row = main.createInstance();
    created.push(row.id);
    try {
      const region = slot(row);
      for (const cell of [...region.children]) cell.remove();
      const templateCells = table.cells[table.rows.indexOf(template)];
      for (const source of templateCells) {
        const cellMain = await source.getMainComponentAsync();
        await loadFonts(api, cellMain);
        const cell = cellMain.createInstance();
        region.appendChild(cell);
        await cellWidth(cell, source.width);
        created.push(cell.id);
      }
    } catch (error) {
      row.remove();
      throw error;
    }
    slot(table.root).appendChild(row);
    table.rows.push(row);
    table.cells.push([...slot(row).children]);
    await layoutTable(table.root, table.rows, table.cells);
  } else throw Error("Unknown composition action.");
  changed.push(table.root.id, ...table.rows.map((row) => row.id));
  return {
    createdNodeIds: created,
    mutatedNodeIds: [...new Set(changed)],
    message:
      action === "add-column"
        ? "Added a column to every row."
        : action === "add-row"
          ? "Added a linked body row."
          : "Matched the selected column width across all rows.",
  };
}
async function appendSegment(api: PluginAPI, root: Node) {
  const region = slot(root);
  for (const child of region.children)
    if ((await sourceId(child)) !== IDs.item)
      throw Error("Segments contains a non-segment component.");
  if (region.children.length >= 10)
    throw Error("The pinned component supports up to ten segments.");
  const source =
    region.children[0] ?? slot(await root.getMainComponentAsync()).children[0];
  if (!source) throw Error("No segment template is available.");
  const main = await source.getMainComponentAsync();
  await loadFonts(api, main);
  const item = main.createInstance();
  item.setProperties({
    selected: String(region.children.length === 0),
    disabled: source.componentProperties.disabled.value,
    iconOnly: source.componentProperties.iconOnly.value,
    state: "default",
  });
  await label(api, item, "Segment " + (region.children.length + 1));
  region.appendChild(item);
  if (root.componentProperties.hugWidth?.value === "false")
    item.layoutSizingHorizontal = "FILL";
  return item;
}
