import { build } from "esbuild";
import { readFile, mkdir, writeFile } from "node:fs/promises";
await mkdir("dist", { recursive: true });
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const updateScript = await build({
  entryPoints: ["src/update-ui.ts"],
  bundle: true,
  write: false,
  format: "iife",
  target: "es2017",
});
const ui = (await readFile("src/ui.html", "utf8"))
  .replace(
    "<!-- UPDATE_SCRIPT -->",
    `<script>${updateScript.outputFiles[0].text}</script>`,
  )
  .replace(
    "<!-- PUSH_SCRIPT -->",
    `<script>${await readFile("src/push-ui.js", "utf8")}</script>`,
  );
await build({
  entryPoints: ["src/plugin.ts"],
  bundle: true,
  outfile: "dist/code.js",
  target: "es2017",
  define: {
    __html__: JSON.stringify(ui),
    __pluginVersion__: JSON.stringify(version),
  },
});
await writeFile("dist/ui.html", ui);
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
      networkAccess: {
        allowedDomains: [
          "https://api.github.com",
          "https://registry.npmjs.org",
        ],
        reasoning: "Check published Fondue Sync and Fondue versions on launch.",
        devAllowedDomains: ["http://localhost:3848"],
      },
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Built dist/manifest.json, code.js, ui.html (offline release bundle embedded).",
);
