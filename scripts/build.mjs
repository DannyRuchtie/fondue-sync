import { build } from "esbuild";
import { readFile, mkdir, writeFile } from "node:fs/promises";
await mkdir("dist", { recursive: true });
const ui = (await readFile("src/ui.html", "utf8")).replace(
  "<!-- PUSH_SCRIPT -->",
  `<script>${await readFile("src/push-ui.js", "utf8")}</script>`,
);
await build({
  entryPoints: ["src/plugin.ts"],
  bundle: true,
  outfile: "dist/code.js",
  target: "es2017",
  define: { __html__: JSON.stringify(ui) },
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
        allowedDomains: ["none"],
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
