import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-ignore Node build helpers are deliberately dependency-free ESM.
import {
  parseTokens,
  validateAliases,
  cssValue,
} from "../scripts/build-bundle.mjs";
test("CSS parser preserves theme aliases and converts rem exactly", () => {
  const { tokens } = parseTokens(
    ":root {--color-neutral-00: rgba(255,255,255,1);--color-neutral-100: rgba(0,0,0,1);--spacing-small: .75rem;--color-primary-default: var(--color-neutral-100);}",
    ".base {--color-neutral-00: rgba(255,255,255,1);--color-neutral-100: rgba(0,0,0,1);} .light {--color-primary-default: var(--color-neutral-100);} .dark {--color-primary-default: var(--color-neutral-00);}",
  );
  assert.equal(
    tokens.find((t: any) => t.id === "spacing-small").values.Value,
    12,
  );
  assert.deepEqual(
    tokens.find((t: any) => t.id === "color-primary-default").values,
    {
      Light: { alias: "color-neutral-100" },
      Dark: { alias: "color-neutral-00" },
    },
  );
});
test("unresolved and cyclic aliases fail before canvas mutation", () => {
  assert.throws(
    () =>
      validateAliases([{ id: "a", values: { Value: { alias: "missing" } } }]),
    /Unresolved/,
  );
  assert.throws(
    () =>
      validateAliases([
        { id: "a", values: { Value: { alias: "b" } } },
        { id: "b", values: { Value: { alias: "a" } } },
      ]),
    /Cyclic/,
  );
});
test("CSS values preserve alpha and fixed px geometry", () => {
  assert.deepEqual(cssValue("rgba(255, 0, 128, 0.2)"), {
    r: 1,
    g: 0,
    b: 128 / 255,
    a: 0.2,
  });
  assert.equal(cssValue("1px"), 1);
  assert.equal(cssValue("0.875rem"), 14);
});
test("checked-in released bundle has complete references and traceable source inputs", async () => {
  const { readFileSync } = await import("node:fs");
  const { createHash } = await import("node:crypto");
  const b = JSON.parse(
    readFileSync(
      new URL("../bundles/fondue-13.11.1.json", import.meta.url),
      "utf8",
    ),
  );
  const ids = new Set(b.tokens.map((t: any) => t.id));
  assert.equal(ids.size, b.tokens.length);
  assert.equal(b.tokens.filter((t: any) => !t.provenance).length, 373);
  assert.equal(
    b.tokens.filter((t: any) => t.provenance?.kind === "brand-adaptation")
      .length,
    11,
  );
  validateAliases(b.tokens);
  assert.equal(b.icons.length, 420);
  assert.equal(new Set(b.icons.map((i: any) => i.id)).size, b.icons.length);
  assert.equal(b.styles.filter((s: any) => !s.provenance).length, 33);
  assert.equal(b.provenance.commit, "ebcc9b8579a7f862f43a2732f5a5b9c3105e6796");
  assert.ok(Object.keys(b.provenance.inputs).length > 1000);
  assert.ok(b.inventory.some((i: any) => i.name === "Card" && i.recipeId));
  assert.equal(
    b.inventory.filter((i: any) => i.kind === "nonvisual").length,
    2,
  );
  const walk = (n: any) => {
    for (const id of Object.values(n.bindings ?? {}))
      assert.ok(ids.has(id), `Missing binding ${id}`);
    for (const c of n.children ?? []) walk(c);
  };
  for (const r of b.recipes) {
    assert.ok(r.variants.length > 0);
    assert.ok(r.source.length > 0);
    assert.ok(r.limitations.length > 0 || r.status === "supported");
    for (const v of r.variants) walk(v.root);
  }
  const { fingerprint, ...content } = b;
  assert.equal(
    fingerprint,
    createHash("sha256").update(JSON.stringify(content)).digest("hex"),
  );
  assert.ok(
    !Object.keys(b.provenance.inputs).some((p) =>
      /legacyTokens|packages\/rich-text-editor\//.test(p),
    ),
  );
});
test("source lock rejects changed content, extra files and moved provenance", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path"); // @ts-ignore dependency-free helper
  const { validateSourceLock, sha, COMMIT } =
    await import("../scripts/build-bundle.mjs");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fondue-source-lock-"));
  try {
    fs.writeFileSync(path.join(tmp, "a.txt"), "original");
    const lock = { commit: COMMIT, files: { "a.txt": sha("original") } };
    validateSourceLock(tmp, lock);
    fs.writeFileSync(path.join(tmp, "a.txt"), "modified");
    assert.throws(() => validateSourceLock(tmp, lock), /modified/);
    fs.writeFileSync(path.join(tmp, "a.txt"), "original");
    fs.writeFileSync(path.join(tmp, "b.txt"), "extra");
    assert.throws(() => validateSourceLock(tmp, lock), /inventory drifted/);
    assert.throws(
      () => validateSourceLock(tmp, { ...lock, commit: "wrong" }),
      /commit mismatch/,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
test("released text style units and value-only breakpoint syntax retain source semantics", async () => {
  const { readFileSync } = await import("node:fs");
  const b = JSON.parse(
    readFileSync(
      new URL("../bundles/fondue-13.11.1.json", import.meta.url),
      "utf8",
    ),
  );
  const style = b.styles.find((s: any) => s.id === "text-body-medium-default");
  assert.equal(style.fontSize, 14);
  assert.equal(style.lineHeight, 18);
  assert.equal(style.letterSpacing, 0);
  const breakpoint = b.tokens.find((t: any) => t.id === "breakpoint-lg");
  assert.equal(breakpoint.values.Value, 1024);
  assert.equal(breakpoint.css, "1024px");
  assert.ok(!breakpoint.css.startsWith("var("));
});
test("all released optical SVGs retain exact source geometry and hashes instead of scaled canonical paths", async () => {
  const { readFileSync } = await import("node:fs");
  const { createHash } = await import("node:crypto");
  const b = JSON.parse(
    readFileSync(
      new URL("../bundles/fondue-13.11.1.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(b.icons.length, 420);
  assert.equal(
    b.icons.reduce((count: number, icon: any) => count + icon.sizes.length, 0),
    2099,
  );
  const sources = new Set<string>();
  for (const icon of b.icons) {
    assert.ok(Array.isArray(icon.sizes) && icon.sizes.length > 0, icon.id);
    const dimensions = icon.sizes.map((s: any) => s.size);
    assert.deepEqual(
      dimensions,
      [...new Set(dimensions)].sort((a: any, c: any) => a - c),
    );
    const canonical = icon.sizes.find((s: any) => s.size === 24);
    assert.ok(canonical, icon.id);
    assert.equal(icon.svg, canonical.svg);
    assert.equal(icon.source, canonical.source);
    for (const optical of icon.sizes) {
      assert.ok([12, 16, 20, 24, 32].includes(optical.size));
      assert.ok(!sources.has(optical.source));
      sources.add(optical.source);
      assert.equal(
        createHash("sha256").update(optical.svg).digest("hex"),
        b.provenance.inputs[optical.source],
      );
      assert.ok(
        new RegExp(`-${optical.size}(-filled)?\\.svg$`).test(optical.source),
      );
      assert.ok(optical.svg.startsWith("<svg"));
    }
  }
  const check = b.icons.find((i: any) => i.id === "icon:check-mark");
  assert.notEqual(check.sizes.find((s: any) => s.size === 16).svg, check.svg);
  assert.deepEqual(
    b.icons
      .find((i: any) => i.id === "icon:apps")
      .sizes.map((s: any) => s.size),
    [16, 20, 24, 32],
  );
  const recordedSvgInputs = Object.keys(b.provenance.inputs).filter(
    (p) => p.startsWith("packages/icons/icons/") && p.endsWith(".svg"),
  );
  assert.equal(recordedSvgInputs.length, sources.size);
  assert.ok(recordedSvgInputs.every((source) => sources.has(source)));
});
