# Released source-token defects

Baseline: `@frontify/fondue@13.11.1`, commit `ebcc9b8579a7f862f43a2732f5a5b9c3105e6796`.

Three color token names referenced by the current released component styles are absent from the release's committed `base.css` and theme outputs. These are **source-data gaps**, distinct from limitations of the Figma adapter. The plugin does not fetch missing values from Figma and does not silently substitute similarly named tokens.

| Missing custom property | Exact released source | Affected visible state | Native variants omitted |
| --- | --- | --- | ---: |
| `--color-primary-pressed` | `packages/components/src/components/Button/styles/button.module.scss:168,178` | `variant=default`, `emphasis=default` or `weak`, active | 2 |
| `--color-container-success-on-success-container-pressed` | `packages/components/src/components/Button/styles/button.module.scss:202` | `variant=positive`, `emphasis=default`, active | 1 |
| `--color-container-disabled-on-disabled` | `packages/components/src/components/Tag/styles/tag.module.scss:74,79` | Disabled Tag, both variants, emphases, sizes, and main/hover content | 16 |
| `--color-container-disabled-on-disabled` | `packages/components/src/components/Link/styles/link.module.scss:101` | `onContainer=disabled`, with link itself enabled, default or hover | 8 |

**27 reviewed-profile states are omitted.** The full Cartesian inventory would contain 220 affected combinations; the importer deliberately uses a smaller reviewed profile contract. The 27 selected unresolved profiles and their intended variant properties and missing tokens remain inspectable in `docs/control-coverage.json` under `omittedSourceStates`. Other states in the affected sets remain available; those sets carry `partial` status. A disabled Link itself uses the valid `--color-disabled-default` and remains available.

## What the released browser actually does

Unmodified component SCSS was compiled with Sass and combined with the committed token stylesheet in installed Google Chrome through headless Playwright. Chrome DevTools `CSS.forcePseudoState` applied Button's `hover` and `active` style rules; CSS transitions were disabled only to remove timing from the measurement. Tag and Link used their actual source data attributes/classes.

Each case was measured twice, with parent colors `rgb(11, 22, 33)` and `rgb(44, 55, 66)`. In every case the computed component `color` equaled its parent's color. The missing custom property invalidates that winning `color` declaration at computed-value time. As `color` is inherited, browser output depends on the arbitrary consumer ancestor; it does **not** reliably recover a prior hover/default declaration or a similarly named token.

Consequently, the released repository does not define a universal fixed Figma color for these states. Importing them with a chosen semantic token would invent a design decision. Detailed observed values and measurement method are recorded in [source-token-defects-browser.json](source-token-defects-browser.json).

## Reproduce

The browser check is optional and does not affect the plugin build:

```sh
npm install --prefix .cache/browser playwright sass --no-audit --no-fund
node scripts/verify-source-token-defects.mjs
```

The script uses the installed `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, reads only the pinned `.cache/release` source, and writes the evidence JSON. For another operating system, adjust the explicit Chrome executable path in that script.

## Resolve upstream

The Fondue source owner should decide whether each reference is a typo, an intentionally inherited color, or a missing generated token. Fix the reference or add the intended token through Fondue's existing authoring/build pipeline, publish an aligned release, then rebuild this bundle from that release. The importer must derive the result from released repository artifacts. No existing token ownership is changed by this report.
