import type { Bundle, Recipe } from "./schema";
import { read as readMetadata, write as writeMetadata } from "./metadata";

/** Presentation ledger. Asset IDs and applied snapshots remain owned by SyncEngine. */
export type SectionIndex = {
  assets: Record<string, { id: string; kind: string }>;
  pages: Record<string, string>;
  sections?: Record<string, string>;
  sectionGuides?: Record<string, string>;
};
export type SectionReport = {
  sections: {
    key: string;
    id: string;
    pageId: string;
    assetIds: string[];
    guideIds: string[];
    width: number;
    height: number;
  }[];
  warnings: string[];
};
type Metadata = {
  read: (node: any, key: string) => string;
  write: (node: any, key: string, value: string) => void;
};
type Pair = { asset: SceneNode; guide?: SceneNode };
type Group = {
  key: string;
  name: string;
  page: string;
  pairs: Pair[];
  icons?: boolean;
  example?: NonNullable<Bundle["examples"]>[number];
};
const INSET = 64,
  PAIR_GAP = 96,
  ROW_GAP = 96,
  SECTION_GAP = 160,
  PAGE_WIDTH = 14000;

function destination(recipe: Recipe): { namespace: string; page: string } {
  const pkg = recipe.package
    .replace(/^@frontify\/fondue\//, "")
    .replace(/^@frontify\/fondue-/, "");
  if (pkg === "charts") return { namespace: "charts", page: "Charts" };
  if (pkg === "rte") return { namespace: "rte", page: "Rich text" };
  if (pkg.includes("patterns") || recipe.id.startsWith("patterns/"))
    return { namespace: "patterns", page: "Product patterns" };
  return { namespace: "components", page: "Components" };
}
function finite(value: number, fallback = 1) {
  return Number.isFinite(value) ? Math.max(value, fallback) : fallback;
}
function height(node: SceneNode) {
  return finite(node.height);
}
function width(node: SceneNode) {
  return finite(node.width);
}
function bottom(node: SceneNode) {
  return finite(node.y, 0) + height(node);
}
function pageKey(index: SectionIndex, wanted: string) {
  const normalize = (text: string) => text.toLowerCase().replace(/\s/g, "");
  return (
    Object.keys(index.pages).find(
      (key) => normalize(key) === normalize(wanted),
    ) ?? wanted
  );
}
function captionText(example: NonNullable<Bundle["examples"]>[number]) {
  const docs = example.documentation;
  return [
    example.name,
    docs?.purpose,
    docs?.usage,
    docs?.properties,
    docs?.origin,
  ]
    .filter(
      (value, index, values) =>
        typeof value === "string" &&
        value.trim() &&
        values.indexOf(value) === index,
    )
    .join("\n\n");
}

/** Group existing native assets by type and put each existing usage guide beside its set.
 * Appending changes parent only: main component, variant, child, guide and instance IDs survive.
 * Sections are adopted exclusively through the ledger, never by a matching displayed name.
 */
export async function organizeSections(
  api: PluginAPI,
  bundle: Bundle,
  index: SectionIndex,
  save: () => void,
  metadata: Metadata = { read: readMetadata, write: writeMetadata },
): Promise<SectionReport> {
  const report: SectionReport = { sections: [], warnings: [] };
  const groups = new Map<string, Group>();
  const nodeCache = new Map<string, BaseNode | null>();
  const resolve = async (id: string) => {
    if (!nodeCache.has(id)) nodeCache.set(id, await api.getNodeByIdAsync(id));
    return nodeCache.get(id)!;
  };
  const scene = async (assetKey: string): Promise<SceneNode | undefined> => {
    const ref = index.assets[assetKey];
    if (!ref) {
      report.warnings.push(
        `Section layout skipped absent managed reference ${assetKey}.`,
      );
      return;
    }
    const node = await resolve(ref.id);
    if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
      report.warnings.push(
        `Section layout skipped missing canvas asset ${assetKey} (${ref.id}).`,
      );
      return;
    }
    return node;
  };
  for (const recipe of bundle.recipes) {
    const asset = await scene("recipe:" + recipe.id);
    if (!asset) continue;
    const target = destination(recipe),
      family = recipe.name.split("/")[0];
    const key = `${target.namespace}/${family}`;
    let group = groups.get(key);
    if (!group) {
      group = { key, name: family, page: target.page, pairs: [] };
      groups.set(key, group);
    }
    const guide = index.assets["guide:" + recipe.id]
      ? await scene("guide:" + recipe.id)
      : undefined;
    group.pairs.push({ asset, guide });
  }
  if (bundle.icons.length) {
    const pairs: Pair[] = [];
    for (const icon of bundle.icons) {
      const asset = await scene("icon:" + icon.id);
      if (asset) pairs.push({ asset });
    }
    if (pairs.length)
      groups.set("icons", {
        key: "icons",
        name: "Icons",
        page: "Icons",
        pairs,
        icons: true,
      });
  }
  for (const example of bundle.examples ?? []) {
    const asset = await scene("example:" + example.id);
    if (asset)
      groups.set(example.id, {
        key: example.id,
        name: example.name.replace(/^Example\s*\/\s*/, ""),
        page: "Examples",
        pairs: [{ asset }],
        example,
      });
  }
  // Read every existing section/page/caption before making changes. Wrong ledger types are
  // recovery errors; a similarly named user section is never a substitute.
  const sections = new Map<string, SectionNode>(),
    pages = new Map<string, PageNode>(),
    captions = new Map<string, TextNode>();
  for (const group of groups.values()) {
    const sectionId = index.sections?.[group.key];
    if (sectionId) {
      const node = await resolve(sectionId);
      if (node && node.type !== "SECTION")
        throw Error(
          `Managed section identity changed: ${group.key} (${sectionId}).`,
        );
      if (node) {
        const owner = metadata.read(node, "section-group");
        if (owner && owner !== group.key)
          throw Error(
            `Managed section ownership differs: ${group.key} (${sectionId}).`,
          );
        sections.set(group.key, node as SectionNode);
      }
    }
    const key = pageKey(index, group.page),
      pageId = index.pages[key];
    if (pageId && !pages.has(key)) {
      const node = await resolve(pageId);
      if (!node || node.type !== "PAGE")
        throw Error(`Managed page missing or changed: ${key} (${pageId}).`);
      if ("loadAsync" in node) await node.loadAsync();
      pages.set(key, node as PageNode);
    }
    const captionId = index.sectionGuides?.[group.key];
    if (captionId && group.example) {
      const node = await resolve(captionId);
      if (node && node.type !== "TEXT")
        throw Error(
          `Managed example caption identity changed: ${group.key} (${captionId}).`,
        );
      if (node) captions.set(group.key, node as TextNode);
    }
  }
  // Example captions use only the bundle's authored documentation; icons get no invented guide.
  if ([...groups.values()].some((group) => group.example))
    await api.loadFontAsync({ family: "Inter", style: "Regular" });
  // Resolve shared semantic colors before allocating any new sections/captions.
  // Binding keeps the presentation readable in the same Light/Dark mode as its assets.
  const paintFor = async (
    tokenId: string,
    fallback: RGB,
  ): Promise<SolidPaint | undefined> => {
    const ref = index.assets["token:" + tokenId];
    if (!ref) return undefined;
    const variable = await api.variables.getVariableByIdAsync(ref.id);
    if (!variable || variable.resolvedType !== "COLOR") {
      report.warnings.push(
        `Section presentation could not resolve semantic color ${tokenId}.`,
      );
      return undefined;
    }
    return api.variables.setBoundVariableForPaint(
      { type: "SOLID", color: fallback },
      "color",
      variable,
    );
  };
  const sectionPaint = await paintFor("color-surface-default", {
    r: 1,
    g: 1,
    b: 1,
  });
  const captionPaint = await paintFor("color-primary-default", {
    r: 0,
    g: 0,
    b: 0,
  });
  index.sections ??= {};
  index.sectionGuides ??= {};
  const sorted = [...groups.values()].sort(
    (a, b) =>
      a.page.localeCompare(b.page, "en") || a.name.localeCompare(b.name, "en"),
  );
  const recognized = new Set(
    sorted.flatMap((group) =>
      group.pairs.flatMap((pair) => [
        pair.asset.id,
        ...(pair.guide ? [pair.guide.id] : []),
      ]),
    ),
  );
  for (const id of Object.values(index.sections)) recognized.add(id);
  for (const id of Object.values(index.sectionGuides)) recognized.add(id);
  for (const group of sorted) {
    const key = pageKey(index, group.page);
    let page = pages.get(key);
    if (!page) {
      page = api.createPage();
      page.name = "Fondue / " + group.page;
      index.pages[key] = page.id;
      pages.set(key, page);
      save();
    }
    let section = sections.get(group.key);
    if (!section) {
      section = api.createSection();
      page.appendChild(section);
      index.sections[group.key] = section.id;
      sections.set(group.key, section);
      recognized.add(section.id);
      save(); // Persist the newly allocated identity before any further await.
      metadata.write(section, "section-group", group.key);
    } else if (section.parent?.id !== page.id) page.appendChild(section);
    section.name = group.name;
    if (sectionPaint) section.fills = [sectionPaint];
    if (metadata.read(section, "section-group") !== group.key)
      metadata.write(section, "section-group", group.key);
    if (group.example) {
      let caption = captions.get(group.key);
      const text = captionText(group.example);
      if (!caption) {
        caption = api.createText();
        section.appendChild(caption);
        index.sectionGuides[group.key] = caption.id;
        captions.set(group.key, caption);
        recognized.add(caption.id);
        save();
        caption.fontName = { family: "Inter", style: "Regular" };
        if (captionPaint) caption.fills = [captionPaint];
        caption.fontSize = 14;
        caption.lineHeight = { unit: "PIXELS", value: 20 };
        caption.textAutoResize = "HEIGHT";
        caption.resize(650, 1);
        caption.characters = text;
        metadata.write(caption, "section-caption-source", text);
      } else {
        const baseline = metadata.read(caption, "section-caption-source");
        if (baseline && caption.characters !== baseline)
          report.warnings.push(
            `Preserved locally edited example caption ${group.key}.`,
          );
        else if (caption.characters !== text) {
          caption.characters = text;
          metadata.write(caption, "section-caption-source", text);
        }
      }
      caption.name = group.name + " / usage";
      group.pairs[0].guide = caption;
    }
    // User children in a managed section keep their local coordinates. Managed rows start
    // beneath them so reorganizing does not place the library catalog over local notes.
    const unknown = section.children.filter(
      (child) => !recognized.has(child.id),
    );
    let y = unknown.length
      ? Math.max(INSET, ...unknown.map(bottom)) + ROW_GAP
      : INSET;
    let extent = unknown.length
      ? Math.max(INSET, ...unknown.map((child) => child.x + width(child)))
      : 0;
    if (group.icons) {
      let x = INSET,
        rowHeight = 0,
        count = 0;
      for (const { asset } of group.pairs) {
        if (count && (count >= 6 || x + width(asset) + INSET > PAGE_WIDTH)) {
          y += rowHeight + ROW_GAP;
          x = INSET;
          rowHeight = 0;
          count = 0;
        }
        if (asset.parent?.id !== section.id) section.appendChild(asset);
        asset.x = x;
        asset.y = y;
        x += width(asset) + PAIR_GAP;
        rowHeight = Math.max(rowHeight, height(asset));
        count++;
        extent = Math.max(extent, asset.x + width(asset));
      }
      y += rowHeight;
    } else {
      for (const pair of group.pairs) {
        const { asset, guide } = pair;
        if (asset.parent?.id !== section.id) section.appendChild(asset);
        asset.x = INSET;
        asset.y = y;
        let rowWidth = width(asset),
          rowHeight = height(asset);
        if (guide) {
          if (guide.parent?.id !== section.id) section.appendChild(guide);
          guide.x = INSET + width(asset) + PAIR_GAP;
          guide.y = y;
          rowWidth += PAIR_GAP + width(guide);
          rowHeight = Math.max(rowHeight, height(guide));
        }
        extent = Math.max(extent, INSET + rowWidth);
        y += rowHeight + ROW_GAP;
      }
      y = Math.max(INSET, y - ROW_GAP);
    }
    // SectionNode supports resizeWithoutConstraints, not Auto Layout. Never resize its children.
    section.resizeWithoutConstraints(
      Math.max(2 * INSET, extent + INSET),
      Math.max(2 * INSET, y + INSET),
    );
    report.sections.push({
      key: group.key,
      id: section.id,
      pageId: page.id,
      assetIds: group.pairs.map((pair) => pair.asset.id),
      guideIds: group.pairs.flatMap((pair) =>
        pair.guide ? [pair.guide.id] : [],
      ),
      width: section.width,
      height: section.height,
    });
  }
  // Variable-size packing: at most two section columns, and oversized families get a row
  // of their own. Unrelated page nodes stay at exactly their existing positions.
  for (const page of pages.values()) {
    const owned = report.sections.filter(
      (section) => section.pageId === page.id,
    );
    const outsiders = page.children.filter((node) => !recognized.has(node.id));
    let y = outsiders.length
      ? Math.max(0, ...outsiders.map(bottom)) + SECTION_GAP
      : 0;
    let x = 0,
      rowHeight = 0,
      columns = 0;
    for (const item of owned) {
      const section = sections.get(item.key)!;
      if (columns && (columns >= 2 || x + item.width > PAGE_WIDTH)) {
        y += rowHeight + SECTION_GAP;
        x = 0;
        rowHeight = 0;
        columns = 0;
      }
      section.x = x;
      section.y = y;
      x += item.width + SECTION_GAP;
      rowHeight = Math.max(rowHeight, item.height);
      columns++;
      if (item.width > PAGE_WIDTH) {
        y += rowHeight + SECTION_GAP;
        x = 0;
        rowHeight = 0;
        columns = 0;
      }
    }
  }
  save();
  return report;
}
