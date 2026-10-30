# Native runtime evidence — 2026-10-30

This record supersedes the original pre-runtime delivery checkpoint in verification-evidence.md.

- Source: Fondue 13.11.1, commit `ebcc9b8579a7f862f43a2732f5a5b9c3105e6796`.
- Plugin: 0.1.1. Bundle fingerprint: `70d4058bb7aa4dad5a50d1a62643b347e5677102b13b36403692f19dc029391c`.
- Local verification: `npm run verify` passed: generation, TypeScript, 123 tests, distribution build. Formatting and diff whitespace checks passed.
- Original file: [PD Figma Sync](https://www.figma.com/design/O5xq8vIIlxUCYXscYcNVww/PD-Figma-Sync?node-id=0-1).
- Clean rebuild: [PD Figma Sync — clean rebuild](https://www.figma.com/design/ZmOzqBnHNixUTV1TqRtBHs), in the same Frontify project. The user explicitly authorized starting from a clean slate. The original file was retained.

## Original rendering diagnosis and first repair

Native Figma rejected two documentation links with: `Documentation links API takes a list of size 0 or 1`. This occurred before variant population, leaving blank component shells. The engine now keeps one native link and preserves additional source links in descriptions and adjacent guides. A strict regression reproduces the native limit.

The first repair preserved Text/color-default set `1:7747` and populated its twelve variants. GuidelinesEmptyState `1:8134` became a visible editable composition. A native screenshot is saved in `evidence/native-guidelines-repaired.png`.

Further native failures exposed empty source variant values and vertical BASELINE alignment. Empty values now have the native-safe display label `(empty)` while exact raw properties remain in managed metadata. Vertical layouts use MIN for source baseline alignment. Native icon fallbacks now scale glyph geometry, rather than only the instance wrapper.

The first integrated update of the original file reported 54 conflicts and stopped before applying changes. These were not blindly accepted or overwritten. Before completing that investigation, the user authorized a clean rebuild. The old file remains available for reference.

## Requested token and organization changes

- 384 released variables plus 31 explicitly labelled native constants derived from source/recipe values: 415 variables total.
- All reviewed Auto Layout padding and gaps, independent corner radii and visible border widths have exact-role variable bindings. Missing published scale values receive separately named component constants, with provenance.
- 37 styles, including four exact source-derived shadow/focus effect styles. Effect color, blur, spread and both offsets use variable bindings.
- SVG paint rules preserve vector geometry and bind chart/source roles. Icon currentColor defaults bind a semantic foreground variable.
- Component families use native Sections, with each profile's matching usage guide beside it. Icons share a section; examples have sections with source-backed captions.
- Fixed widths/heights, path coordinates, ellipse geometry and data artwork/gradients retain their source geometry/content. Editing one variable does not recompute an arithmetic expression represented by a separately documented native constant.

## Acceptance still to record

Clean-file native generation, structural audit, screenshots, token-change propagation and clean repeat comparison are pending. Local tests do not establish those results. Library publication, cross-file consumer updates, comprehensive visual parity, live API prototypes and reverse PR flow are outside this runtime checkpoint.
