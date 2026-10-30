import { build } from "esbuild";
import { readFile, mkdir, writeFile } from "node:fs/promises";
await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["src/plugin.ts"],
  bundle: true,
  outfile: "dist/code.js",
  target: "es2017",
  define: { __html__: JSON.stringify(await readFile("src/ui.html", "utf8")) },
});
await writeFile("dist/ui.html", await readFile("src/ui.html"));
await writeFile(
  "dist/manifest.json",
  JSON.stringify(
    {
      name: "Fondue Sync",
      id: "fondue-sync-development",
      api: "1.0.0",
      main: "code.js",
      ui: "ui.html",
      editorType: ["figma"],
      documentAccess: "dynamic-page",
      networkAccess: { allowedDomains: ["none"] },
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Built dist/manifest.json, code.js, ui.html (offline release bundle embedded).",
);
