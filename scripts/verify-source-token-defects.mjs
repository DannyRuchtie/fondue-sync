import fs from "node:fs";
const sass = await import(
  new URL("../.cache/browser/node_modules/sass/sass.node.mjs", import.meta.url)
);
const { chromium } = await import(
  new URL(
    "../.cache/browser/node_modules/playwright/index.mjs",
    import.meta.url,
  )
);
const base = new URL("../.cache/release/", import.meta.url).pathname;
const browser = await chromium.launch({
  headless: true,
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const page = await browser.newPage();
const cdp = await page.context().newCDPSession(page);
await cdp.send("DOM.enable");
await cdp.send("CSS.enable");
const results = [];
const tokens = fs.readFileSync(
  base + "packages/tokens/dist/css/base.css",
  "utf8",
);
for (const entry of [
  {
    family: "Button",
    file: "button.module.scss",
    html: '<button class="root" data-variant="default" data-emphasis="default" data-size="medium">Button</button>',
    active: true,
    state: "default/default :active",
  },
  {
    family: "Button",
    file: "button.module.scss",
    html: '<button class="root" data-variant="default" data-emphasis="weak" data-size="medium">Button</button>',
    active: true,
    state: "default/weak :active",
  },
  {
    family: "Button",
    file: "button.module.scss",
    html: '<button class="root" data-variant="positive" data-emphasis="default" data-size="medium">Button</button>',
    active: true,
    state: "positive/default :active",
  },
  {
    family: "Tag",
    file: "tag.module.scss",
    html: '<div class="root" data-variant="default" data-disabled="true"><div class="mainContent">Tag</div></div>',
    state: "disabled",
  },
  {
    family: "Link",
    file: "link.module.scss",
    html: '<a class="root color-on-container-disabled size-medium">Link</a>',
    state: "onContainer=disabled, disabled=false",
  },
]) {
  const css = sass.compile(
    base +
      `packages/components/src/components/${entry.family}/styles/${entry.file}`,
  ).css;
  for (const parent of ["rgb(11, 22, 33)", "rgb(44, 55, 66)"]) {
    await page.setContent(
      `<style>${tokens}\n${css}\n*{transition:none!important}</style><div id="ancestor" style="color:${parent}">${entry.html}</div>`,
    );
    const target = page.locator(".root");
    if (entry.active) {
      const { root } = await cdp.send("DOM.getDocument");
      const { nodeId } = await cdp.send("DOM.querySelector", {
        nodeId: root.nodeId,
        selector: ".root",
      });
      await cdp.send("CSS.forcePseudoState", {
        nodeId,
        forcedPseudoClasses: ["hover", "active"],
      });
    }
    const actual = await target.evaluate((el) => ({
      computed: getComputedStyle(el).color,
      active: el.matches(":active"),
      parent: getComputedStyle(el.parentElement).color,
    }));
    results.push({
      family: entry.family,
      state: entry.state,
      forcedActive: !!entry.active,
      ...actual,
    });
  }
}
await browser.close();
fs.writeFileSync(
  new URL("../docs/source-token-defects-browser.json", import.meta.url),
  JSON.stringify(
    {
      browser: "Installed Google Chrome, Playwright headless",
      source:
        "Compiled unmodified pinned release SCSS with Sass; committed token base.css; Chrome DevTools CSS.forcePseudoState sets active+hover; only transitions disabled for deterministic measurement",
      results,
    },
    null,
    2,
  ) + "\n",
);
console.log(results);
