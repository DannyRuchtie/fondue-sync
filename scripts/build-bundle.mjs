import { augmentComponentPropertyPolicies } from "../src/component-properties.mjs";
import { loadImageAssets, enrichImageReferences } from "./image-assets.mjs";
import { augmentTypographyBindings } from "../recipes/typography-bindings.mjs";
import fs from "node:fs";
import { augmentTokenBindings } from "../recipes/token-bindings.mjs";
import { augmentPaintBindings } from "../recipes/paint-bindings.mjs";
import path from "node:path";
import crypto from "node:crypto";
import {
  documentation,
  normalizeRecipeDocumentation,
} from "../recipes/documentation.mjs";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const RELEASE = "13.11.1";
export const COMMIT = "ebcc9b8579a7f862f43a2732f5a5b9c3105e6796";
export const sha = (data) =>
  crypto.createHash("sha256").update(data).digest("hex");
export function declarations(css) {
  return Object.fromEntries(
    [...css.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map((m) => [
      m[1],
      m[2].trim(),
    ]),
  );
}
export function cssValue(raw) {
  const alias = raw.match(/^var\(--([\w-]+)\)$/);
  if (alias) return { alias: alias[1] };
  const color = raw.match(/^rgba?\(([^)]+)\)$/);
  if (color) {
    const [r, g, b, a = 1] = color[1].split(",").map(Number);
    return { r: r / 255, g: g / 255, b: b / 255, a };
  }
  const num = raw.match(/^(-?[\d.]+)(rem|px)?$/);
  if (num) return Number(num[1]) * (num[2] === "rem" ? 16 : 1);
  return raw.replace(/^['"]|['"]$/g, "");
}
export function validateAliases(tokens) {
  const byId = new Map(tokens.map((t) => [t.id, t]));
  function visit(id, mode, seen = new Set()) {
    if (seen.has(id))
      throw Error(`Cyclic token alias: ${[...seen, id].join(" -> ")}`);
    const t = byId.get(id);
    if (!t) throw Error(`Unresolved token alias ${id}`);
    const v = t.values[mode] ?? t.values.Value ?? t.values.Light;
    if (v?.alias) visit(v.alias, mode, new Set([...seen, id]));
  }
  for (const t of tokens) for (const m of Object.keys(t.values)) visit(t.id, m);
}
export function parseTokens(baseCss, themesCss) {
  const base = declarations(baseCss);
  const blocks = Object.fromEntries(
    [...themesCss.matchAll(/\.([\w-]+)\s*\{([^}]+)\}/g)].map((m) => [
      m[1],
      declarations(m[2]),
    ]),
  );
  const all = { ...base, ...blocks.base, ...blocks.light, ...blocks.dark };
  const tokens = [];
  const composites = [];
  for (const id of Object.keys(all).sort()) {
    if (id.startsWith("shadow-")) {
      composites.push({ id, raw: base[id] ?? all[id] });
      continue;
    }
    const semantic = id in (blocks.light ?? {}) || id in (blocks.dark ?? {});
    const raw = base[id] ?? all[id];
    const value = cssValue(raw);
    const type = id.startsWith("color-")
      ? "COLOR"
      : typeof value === "number" ||
          /(?:font-size|font-weight|letter-spacing|line-height)/.test(id)
        ? "FLOAT"
        : "STRING";
    const values = semantic
      ? {
          Light: cssValue(blocks.light?.[id] ?? blocks.base?.[id] ?? raw),
          Dark: cssValue(blocks.dark?.[id] ?? blocks.base?.[id] ?? raw),
        }
      : { Value: value };
    let scopes = [];
    if (type === "COLOR")
      scopes = /line-/.test(id)
        ? ["STROKE_COLOR"]
        : /on-|text/.test(id)
          ? ["TEXT_FILL"]
          : semantic
            ? ["FRAME_FILL", "SHAPE_FILL", "TEXT_FILL", "STROKE_COLOR"]
            : [];
    else if (id.startsWith("spacing-")) scopes = ["GAP"];
    else if (id.startsWith("border-radius")) scopes = ["CORNER_RADIUS"];
    else if (id.startsWith("border-width")) scopes = ["STROKE_FLOAT"];
    else if (/font-size/.test(id)) scopes = ["FONT_SIZE"];
    else if (/font-weight/.test(id)) scopes = ["FONT_WEIGHT"];
    else if (/line-height/.test(id)) scopes = ["LINE_HEIGHT"];
    else if (/letter-spacing/.test(id)) scopes = ["LETTER_SPACING"];
    tokens.push({
      id,
      name: id.replaceAll("-", "/"),
      type,
      collection: semantic ? "Semantic" : "Primitives",
      values,
      css: `var(--${id})`,
      scopes,
    });
  }
  validateAliases(tokens);
  return { tokens, composites, raw: base };
}
function files(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
    .flatMap((e) =>
      e.isDirectory()
        ? files(path.join(dir, e.name))
        : [path.join(dir, e.name)],
    );
}
export function makeStyles(tokens, composites, raw) {
  const by = new Map(tokens.map((t) => [t.id, t]));
  const resolve = (id) => {
    const v = by.get(id)?.values.Value ?? by.get(id)?.values.Light;
    if (v?.alias) return resolve(v.alias);
    return v;
  };
  const styles = [];
  const groups = [
    ...new Set(
      tokens
        .filter((t) => t.id.startsWith("text-"))
        .map((t) =>
          t.id.replace(
            /-(font-family|font-size|font-weight|letter-casing|letter-spacing|line-height)$/,
            "",
          ),
        ),
    ),
  ].sort();
  for (const id of groups) {
    const binding = (prop) => `${id}-${prop}`;
    const weight = resolve(binding("font-weight"));
    styles.push({
      id,
      name: id.replaceAll("-", "/"),
      type: "TEXT",
      fontFamily: String(resolve(binding("font-family")))
        .split(",")[0]
        .trim(),
      fontStyle:
        { 300: "Light", 400: "Regular", 500: "Medium", 700: "Bold" }[weight] ??
        "Regular",
      fontSize: resolve(binding("font-size")),
      lineHeight: resolve(binding("line-height")),
      letterSpacing: resolve(binding("letter-spacing")),
      textCase:
        resolve(binding("letter-casing")) === "uppercase"
          ? "UPPER"
          : "ORIGINAL",
      bindings: {
        fontSize: binding("font-size"),
        fontWeight: binding("font-weight"),
        lineHeight: binding("line-height"),
        letterSpacing: binding("letter-spacing"),
      },
    });
  }
  for (const c of composites) {
    const m = c.raw.match(
      /^(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px\s+(-?[\d.]+)px\s+var\(--([\w-]+)\)$/,
    );
    if (!m) throw Error(`Unsupported shadow composite ${c.id}: ${c.raw}`);
    styles.push({
      id: c.id,
      name: c.id.replaceAll("-", "/"),
      type: "EFFECT",
      colorToken: m[5],
      effects: [
        {
          type: "DROP_SHADOW",
          color: resolve(m[5]),
          offset: { x: +m[1], y: +m[2] },
          radius: +m[3],
          spread: +m[4],
          visible: true,
          blendMode: "NORMAL",
        },
      ],
    });
  }
  return styles;
}
export function validateSourceLock(source, sourceLock) {
  if (sourceLock.commit !== COMMIT)
    throw Error(
      "Source lock commit mismatch; run node scripts/prepare-source.mjs",
    );
  const actualFiles = files(source).map((f) =>
    path.relative(source, f).split(path.sep).join("/"),
  );
  if (actualFiles.length !== Object.keys(sourceLock.files).length)
    throw Error(
      "Release snapshot file inventory drifted; prepare source again.",
    );
  for (const rel of actualFiles)
    if (sha(fs.readFileSync(path.join(source, rel))) !== sourceLock.files[rel])
      throw Error(`Release snapshot modified: ${rel}; prepare source again.`);
}
export async function build(source = path.join(root, ".cache/release")) {
  const sourceLock = JSON.parse(
    fs.readFileSync(
      path.join(path.dirname(source), "source-lock.json"),
      "utf8",
    ),
  );
  validateSourceLock(source, sourceLock);
  const inputs = {};
  const read = (rel) => {
    const data = fs.readFileSync(path.join(source, rel), "utf8");
    inputs[rel] = sha(data);
    return data;
  };
  const packageVersions = {};
  for (const name of [
    "components",
    "charts",
    "rte",
    "tokens",
    "icons",
    "sdk",
  ]) {
    const info = JSON.parse(read(`packages/${name}/package.json`));
    packageVersions[info.name] = info.version;
  }
  // Hash all current source definitions, including code-only exported states and stories, without packaging legacy or the unreleased rich-text-editor rewrite.
  for (const name of ["components", "charts", "rte", "tokens", "icons"])
    for (const f of files(path.join(source, `packages/${name}`)).filter(
      (f) =>
        /\.(tsx?|scss|css|json|svg)$/.test(f) &&
        !f.split(path.sep).some((p) => /^legacy/i.test(p)),
    ))
      read(path.relative(source, f).split(path.sep).join("/"));
  const pkg = JSON.parse(read("packages/fondue/package.json"));
  if (pkg.version !== RELEASE)
    throw Error(`Expected release ${RELEASE}, received ${pkg.version}`);
  const { tokens, composites, raw } = parseTokens(
    read("packages/tokens/dist/css/base.css"),
    read("packages/tokens/dist/themes/themes.module.css"),
  );
  const styles = makeStyles(tokens, composites, raw);
  read("packages/tokens/config.json");
  const manifest = JSON.parse(read("packages/tokens/dist/manifest.json"));
  read("packages/tokens/dist/json/utilities.json");
  for (const t of manifest.tokens.filter((t) => t.output === "value"))
    tokens.push({
      id: t.id,
      name: t.id.replaceAll("-", "/"),
      type: "FLOAT",
      collection: "Primitives",
      values: { Value: cssValue(t.value) },
      css: t.value,
      scopes: ["WIDTH_HEIGHT"],
    });
  tokens.sort((a, b) => a.id.localeCompare(b.id, "en"));
  const iconFiles = files(path.join(source, "packages/icons/icons")).filter(
    (f) => f.endsWith(".svg"),
  );
  const icons = iconFiles
    .filter((f) => /-24(?:-filled)?\.svg$/.test(f))
    .map((f) => {
      const rel = path.relative(source, f).split(path.sep).join("/");
      const filename = path.basename(f);
      const filled = filename.endsWith("-filled.svg");
      const baseName = filename.replace(/-24(?:-filled)?\.svg$/, "");
      const name = baseName + (filled ? "-filled" : "");
      const sizes = [12, 16, 20, 24, 32].flatMap((size) => {
        const opticalFile = path.join(
          path.dirname(f),
          `${baseName}-${size}${filled ? "-filled" : ""}.svg`,
        );
        if (!fs.existsSync(opticalFile)) return [];
        const opticalSource = path
          .relative(source, opticalFile)
          .split(path.sep)
          .join("/");
        return [{ size, svg: read(opticalSource), source: opticalSource }];
      });
      return { id: `icon:${name}`, name, svg: read(rel), source: rel, sizes };
    });
  const opticalSources = new Set(
    icons.flatMap((icon) => icon.sizes.map((size) => size.source)),
  );
  const unrepresentedOptical = iconFiles
    .map((f) => path.relative(source, f).split(path.sep).join("/"))
    .filter((f) => !opticalSources.has(f));
  if (unrepresentedOptical.length)
    throw Error(
      `SVG sources without a public canonical icon family: ${unrepresentedOptical.join(", ")}`,
    );
  const inventory = [];
  const compIndex = read("packages/components/src/index.ts");
  for (const m of compIndex.matchAll(
    /export\s*\{([^}]+)\}\s*from\s*'\.\/components\/([^']+)'/g,
  )) {
    const exports = m[1]
      .split(",")
      .map((s) => s.trim())
      .filter(
        (n) =>
          n &&
          !n.startsWith("type ") &&
          !n.startsWith("use") &&
          n !== "ThemeContext",
      );
    for (const name of exports) {
      const dir = `packages/components/src/components/${m[2].split("/")[0]}`;
      inventory.push({
        id: `components:${name}`,
        name,
        package: "components",
        kind: ["RouterProvider", "ThemeProvider"].includes(name)
          ? "nonvisual"
          : "visual",
        source: dir,
      });
    }
  }
  const chartIndex = read("packages/charts/src/components/index.ts");
  for (const m of chartIndex.matchAll(/from '\.\/([^'/]+)/g))
    inventory.push({
      id: `charts:${m[1]}`,
      name: m[1],
      package: "charts",
      kind: "visual",
      source: `packages/charts/src/components/${m[1]}`,
    });
  // Published RTE has a root component and exported design primitives. Helpers and Plate runtime plugins remain code mappings, not pretend canvas components.
  read("packages/rte/src/index.ts");
  for (const f of files(
    path.join(source, "packages/rte/src/components"),
  ).filter((f) => /\.tsx?$/.test(f)))
    read(path.relative(source, f).split(path.sep).join("/"));
  inventory.push({
    id: "rte:RichTextEditor",
    name: "RichTextEditor",
    package: "rte",
    kind: "visual",
    source: "packages/rte/src/components/RichTextEditor/RichTextEditor.tsx",
  });
  const { default: baseRecipes } = await import(
    path.join(root, "recipes/index.mjs")
  );
  const overrides = [];
  for (const file of ["foundations", "controls", "patterns"])
    if (fs.existsSync(path.join(root, `recipes/${file}.mjs`)))
      overrides.push(
        ...(await import(path.join(root, `recipes/${file}.mjs`))).default,
      );
  const normalize = (p) => p.replace("@frontify/fondue/", "");
  const families = new Set(
    overrides.map((r) => normalize(r.package) + ":" + r.name.split("/")[0]),
  );
  const authoredExamples = await import(
    path.join(root, "recipes/examples.mjs")
  );
  const additionalFile = path.join(root, "recipes/additional-examples.mjs");
  const examplePatterns = [
    ...authoredExamples.patterns,
    ...(authoredExamples.additionalPatterns ?? []),
  ];
  const examples = [
    ...authoredExamples.screens,
    ...(authoredExamples.additionalScreens ?? []),
  ];
  const mediaFile = path.join(root, "recipes/media-components.mjs");
  const mediaRecipes = fs.existsSync(mediaFile)
    ? (await import(mediaFile)).default
    : [];
  const recipes = [
    ...baseRecipes.filter(
      (r) => !families.has(normalize(r.package) + ":" + r.name.split("/")[0]),
    ),
    ...overrides,
    ...mediaRecipes,
    ...examplePatterns,
  ];
  for (const r of recipes) {
    r.documentation ??= documentation(r, source, COMMIT);
    if (r.package.includes("fondue-sync")) {
      r.documentation.description = [
        r.documentation.purpose,
        r.documentation.usage,
        r.documentation.properties,
        ...r.limitations,
        "Synthetic fixture data only; no live queries.",
      ].join("\n\n");
      r.documentation.links = [
        {
          uri: "https://github.com/DannyRuchtie/fondue-sync/blob/main/docs/examples.md",
        },
      ];
    }
  }
  const packageKind = (p) => p.replace("@frontify/fondue/", "");
  const recipeBy = new Map(recipes.map((r) => [r.id, r]));
  for (const r of recipes) {
    for (const f of r.source ?? []) {
      if (
        fs.existsSync(path.join(source, f)) &&
        fs.statSync(path.join(source, f)).isFile()
      )
        read(f);
      else if (
        fs.existsSync(path.join(source, f)) &&
        fs.statSync(path.join(source, f)).isDirectory()
      )
        for (const nested of files(path.join(source, f)).filter((p) =>
          /\.(tsx?|scss|css|json)$/.test(p),
        ))
          read(path.relative(source, nested).split(path.sep).join("/"));
    }
    if (
      !r.package.includes("fondue-sync") &&
      !inventory.some(
        (i) =>
          i.id === r.id ||
          (i.name === r.name.split("/")[0] &&
            packageKind(i.package) === packageKind(r.package)),
      )
    )
      inventory.push({
        id: r.id,
        name: r.name,
        package: r.package,
        kind: "visual",
        source: r.source,
      });
  }
  const gaps = [];
  for (const i of inventory) {
    const matches = recipes.filter(
      (r) =>
        (r.id === i.id || r.name.split("/")[0] === i.name) &&
        packageKind(r.package) === packageKind(i.package),
    );
    const r = recipeBy.get(i.id) ?? matches[0];
    i.recipeId = r?.id ?? null;
    i.recipeIds = matches.map((r) => r.id);
    i.status =
      i.kind === "nonvisual"
        ? "code-only"
        : !matches.length
          ? "unsupported"
          : matches.every((r) => r.status === "supported")
            ? "supported"
            : "partial";
    if (i.status !== "supported")
      gaps.push({
        id: i.id,
        status: i.status,
        limitations: matches.length
          ? [...new Set(matches.flatMap((r) => r.limitations))]
          : [
              i.kind === "nonvisual"
                ? "Runtime provider; represented as code mapping only."
                : "No reviewed native recipe available.",
            ],
      });
  }
  for (const t of tokens)
    if (t.type === "STRING" && t.id.includes("font-family"))
      gaps.push({
        id: t.id,
        status: "font-requirement",
        limitations: [
          `Font stack source: ${t.values.Value}; install the first family for faithful typography. Figma does not implement CSS fallback stacks.`,
        ],
      });
  const compoundMap = new Map();
  for (const file of files(
    path.join(source, "packages/components/src/components"),
  ).filter((f) => /\.tsx?$/.test(f) && !/(tests|stories)/.test(f))) {
    const rel = path.relative(source, file).split(path.sep).join("/");
    for (const m of fs
      .readFileSync(file, "utf8")
      .matchAll(/\.displayName\s*=\s*['"]([A-Z]\w*(?:\.[A-Z]\w*)+)['"]/g))
      compoundMap.set(m[1], {
        id: `components:${m[1]}`,
        name: m[1],
        source: rel,
        status: "source-inventory",
        limitations: [
          "Compound source symbol; parent recipe coverage does not guarantee independent property/variant coverage.",
        ],
      });
  }
  const compounds = [...compoundMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "en"),
  );
  const stories = files(path.join(source, "packages/components/src/components"))
    .filter((f) => /\.stories\.tsx$/.test(f))
    .map((file) => ({
      source: path.relative(source, file).split(path.sep).join("/"),
      names: [
        ...fs.readFileSync(file, "utf8").matchAll(/export\s+const\s+(\w+)/g),
      ].map((m) => m[1]),
    }));
  const bundle = {
    schemaVersion: 1,
    release: RELEASE,
    provenance: {
      repository: "https://github.com/Frontify/fondue",
      tag: `@frontify/fondue@${RELEASE}`,
      commit: COMMIT,
      npm: {
        verification:
          "registry-reference-only; package archive not used or independently verified",
        package: "@frontify/fondue",
        version: RELEASE,
        integrity:
          "sha512-e9LsLZWjyIErA1d/WathFYo8qKqLJlOxP6U7nB2I/ef6JX5gsuXQr7un+0XNNczmlUBZ8y2bH/H65zpXcy67PA==",
      },
      sourceLockSha256: sha(JSON.stringify(sourceLock)),
      rendererRevision: sha(
        [
          "engine.ts",
          "plan.ts",
          "preflight.ts",
          "snapshot.ts",
          "metadata.ts",
          "recovery.ts",
          "schema.ts",
          "sections.ts",
          "presentation.ts",
          "colors.ts",
          "galleries.ts",
          "documentation.ts",
          "images.ts",
          "image-migrations.ts",
          "image-migration-approvals.json",
          "component-properties.mjs",
        ]
          .map((f) => fs.readFileSync(path.join(root, "src", f), "utf8"))
          .join("\n"),
      ),
      rootRemPx: 16,
      packageVersions,
      definitionInputs: {
        fixtures: Object.fromEntries(
          files(path.join(root, "fixtures")).map((f) => [
            path.relative(root, f),
            sha(fs.readFileSync(f)),
          ]),
        ),
        builder: sha(fs.readFileSync(fileURLToPath(import.meta.url))),
        imageBuilder: sha(
          fs.readFileSync(path.join(root, "scripts/image-assets.mjs")),
        ),
        recipes: Object.fromEntries(
          [
            "index",
            "foundations",
            "controls",
            "patterns",
            "examples",
            "documentation",
            "token-bindings",
            "paint-bindings",
            "typography-bindings",
          ]
            .concat(
              fs.existsSync(additionalFile) ? ["additional-examples"] : [],
              fs.existsSync(mediaFile) ? ["media-components"] : [],
            )
            .map((name) => {
              const f = path.join(root, "recipes", name + ".mjs");
              return [path.relative(root, f), sha(fs.readFileSync(f))];
            }),
        ),
      },
      inputs: Object.fromEntries(
        Object.entries(inputs).sort(([a], [b]) => a.localeCompare(b, "en")),
      ),
    },
    tokens,
    styles,
    icons,
    recipes,
    examples,
    fixtures: Object.fromEntries(
      files(path.join(root, "fixtures"))
        .filter(
          (f) =>
            path.extname(f) === ".json" &&
            !f.startsWith(path.join(root, "fixtures/media") + path.sep),
        )
        .map((f) => [
          path.basename(f, ".json"),
          JSON.parse(fs.readFileSync(f, "utf8")),
        ]),
    ),
    inventory,
    compounds,
    stories,
    gaps,
  };
  const imageCoverage = enrichImageReferences(
    bundle,
    loadImageAssets(path.join(root, "fixtures/media/manifest.json")),
  );
  const tokenBindingCoverage = augmentTokenBindings(bundle);
  const paintBindingCoverage = augmentPaintBindings(bundle, {
    sourceRoot: source,
  });
  bundle.paintBindingCoverage = paintBindingCoverage;
  const typographyBindingCoverage = augmentTypographyBindings(bundle);
  for (const recipe of bundle.recipes) normalizeRecipeDocumentation(recipe);
  const componentPropertyCoverage = augmentComponentPropertyPolicies(bundle);
  fs.writeFileSync(
    path.join(root, "docs/component-property-coverage.json"),
    JSON.stringify(componentPropertyCoverage, null, 2) + "\n",
  );
  bundle.provenance.consumerPresentation = 1;
  bundle.fingerprint = sha(JSON.stringify(bundle));
  fs.mkdirSync(path.join(root, "bundles"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  fs.writeFileSync(
    path.join(root, `bundles/fondue-${RELEASE}.json`),
    JSON.stringify(bundle, null, 2) + "\n",
  );
  const coverage = {
    release: RELEASE,
    fingerprint: bundle.fingerprint,
    counts: {
      tokens: tokens.length,
      releasedTokens: tokens.filter((token) => !token.provenance).length,
      sourceDerivedNativeTokens: tokens.filter((token) => token.provenance)
        .length,
      compoundSourceSymbols: compounds.length,
      stories: stories.reduce((n, s) => n + s.names.length, 0),
      styles: styles.length,
      sourceDerivedEffectStyles: styles.filter(
        (style) => style.type === "EFFECT" && style.provenance,
      ).length,
      sourceDerivedTextStyles: styles.filter(
        (style) => style.type === "TEXT" && style.provenance,
      ).length,
      icons: icons.length,
      opticalIconAssets: icons.reduce(
        (count, icon) => count + icon.sizes.length,
        0,
      ),
      inventory: inventory.length,
      recipes: recipes.length,
      variants: recipes.reduce((n, r) => n + r.variants.length, 0),
      examples: examples.length,
      ...(imageCoverage.assets
        ? {
            imageAssets: imageCoverage.assets,
            imageReferences: imageCoverage.references,
            imageEncodedBytes: imageCoverage.encodedBytes,
          }
        : {}),
      productPatterns: examplePatterns.length,
      documentedSets: recipes.filter((r) => r.documentation?.description)
        .length,
      metadataDocumentedSets: recipes.filter(
        (r) => r.documentation?.origin === "released-metadata",
      ).length,
      supported: inventory.filter((i) => i.status === "supported").length,
      partial: inventory.filter((i) => i.status === "partial").length,
      unsupported: inventory.filter((i) => i.status === "unsupported").length,
      codeOnly: inventory.filter((i) => i.status === "code-only").length,
    },
    inventory,
    compounds,
    gaps,
  };
  fs.writeFileSync(
    path.join(root, "docs/coverage.json"),
    JSON.stringify(coverage, null, 2) + "\n",
  );
  fs.writeFileSync(
    path.join(root, "docs/token-binding-coverage.json"),
    JSON.stringify(tokenBindingCoverage, null, 2) + "\n",
  );
  fs.writeFileSync(
    path.join(root, "docs/color-effect-binding-coverage.json"),
    JSON.stringify(paintBindingCoverage, null, 2) + "\n",
  );
  fs.writeFileSync(
    path.join(root, "docs/typography-binding-coverage.json"),
    JSON.stringify(typographyBindingCoverage, null, 2) + "\n",
  );
  console.log(JSON.stringify(coverage.counts));
  return bundle;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await build(process.argv[2]);
