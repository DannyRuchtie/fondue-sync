# Native runtime evidence — 2026-10-30

This record supersedes the original pre-runtime delivery checkpoint in verification-evidence.md. The opening figures describe the initial native acceptance milestone; later work is recorded separately below.

- Source: Fondue 13.11.1, commit `ebcc9b8579a7f862f43a2732f5a5b9c3105e6796`.
- Plugin: 0.1.1. Bundle fingerprint: `24f597b6dc70c9f3fc5ce7a928547486b27593eb3a42366ab60a7cc3b56270ed`.
- Renderer revision: `73ff7a8ba9cebdf1260fcd5bced5a002b9099c8c6eef82f88e37e77835a365fd`.
- Code checkpoint: `1e671c935c8e15f795a4f9709261d214d48e2915`. [CI passed](https://github.com/DannyRuchtie/fondue-sync/actions/runs/41060800439).
- Local `npm run verify` passed: generation, TypeScript, all 149 tests and distribution build. Formatting and diff whitespace checks passed. The released-bundle API model imports all 1,310 managed assets and repeats with zero writes; this is model evidence, separate from native Figma execution below.
- Original file retained: [PD Figma Sync](https://www.figma.com/design/O5xq8vIIlxUCYXscYcNVww).
- User-authorized clean rebuild: [PD Figma Sync — clean rebuild](https://www.figma.com/design/ZmOzqBnHNixUTV1TqRtBHs), in the same Frontify project.

## Original rendering diagnosis and repair

Native Figma rejected two documentation links: `Documentation links API takes a list of size 0 or 1`. This happened before variant population and left blank sets. The engine now keeps one native link and preserves additional links in descriptions and guides. The strict regression reproduces the native limit.

The first repair retained Text/color-default set `1:7747`, populated its twelve variants and made GuidelinesEmptyState `1:8134` visible. [Native screenshot](evidence/native-guidelines-repaired.png).

Further native checks exposed empty variant labels and invalid vertical BASELINE alignment. Empty values now display `(empty)` while raw source properties remain in metadata. Vertical baseline layouts use MIN. Icon fallback scaling changes glyph geometry rather than only its wrapper.

An update of the original file stopped on 54 conflicts. The user subsequently authorized a clean rebuild; the original file remains available.

## Token and typography representation

At the initial native checkpoint, the source bundle contained 422 variables: 384 released tokens and 38 explicitly labelled source-derived native constants. It included 46 styles, including four exact source-derived shadow/focus styles and nine additional exact text styles. It defined 420 icon families with 2,099 optical drawings, 205 recipe sets, 2,030 variants and twelve example screens.

Reviewed Auto Layout padding and gaps, independent corner radii and visible border widths bind to exact-role variables. Explicit source bindings retain their identities. Otherwise, geometry inference currently matches equal values within the role; an equal value does not prove the original upstream token dependency. Future source token-scale changes require mapping review. Source values absent from the exported scale receive distinct named constants with provenance. Shadow color, blur, spread and both offsets bind through shared effect styles. SVG role bindings preserve source vector geometry. Fixed dimensions, paths and data artwork remain geometry; separately documented constants do not recompute arithmetic expressions.

Required fonts are preflighted before mutation. CSS `Diatype` resolves to installed `ABC Diatype`; Cranny retains its family. Missing required faces block generation. Native testing established that assigning literal font fields after a shared-style link clears that link, so the renderer now applies the style as the typography authority.

The initial clean-library typography migration verified 3,852 existing text layers with shared styles and no Inter. The new production patterns/examples subsequently verified 444 text layers: 429 ABC Diatype and 15 Cranny, all linked to shared styles. Existing numeric foundation specimens use canonical shared styles as well.

The user requested restoration of one ColorPicker.Input alignment. A strict check found exactly one changed field, restored SPACE_BETWEEN and verified the original saved snapshot again. [Exact restoration evidence](evidence/color-picker-alignment-restoration.json).

## Production examples and visual review

A separate agent inspected the signed-in production Brands, Guidelines and populated/empty Libraries overviews. Source definitions remain pinned to the release; production inspection informed screen composition. Names, counts, avatars and artwork are synthetic. Private production screenshots and account content are excluded from the repository.

All twelve native screens were rebuilt with eight reusable patterns, connected native instances and separate Figma Sections. Thirteen obsolete example/pattern/guide assets were removed only after their exact saved snapshots matched. The new patterns and screens contain 786 native instances.

An independent agent reviewed all twelve final native PNGs. Ten matched-reference views passed within the documented static composition/privacy scope. Empty library views at 768 and 390 passed containment/readability; production parity at those sizes remains unverified because matching private references were absent. A minor library-thumbnail tone difference remains. [Final visual review and twelve exports](evidence/production-examples/visual-review.md).

The narrow toolbar overlap observed in production is deliberately retained and documented. These are static native compositions, not working authentication, searching, sorting, navigation or live data integrations. Synthetic artwork and the unverified states prevent a claim of 100% production parity.

## Initial native acceptance

All 107 strict native adoption jobs passed for all 1,310 source assets, with no unexpected snapshot or source differences. [Per-asset adoption evidence](evidence/native-source-adoption.json). A separate narrow source-propagation migration accepted exactly 36 inherited stroke-alias removals across twelve authored screens after proving that the source mains replaced rectangular borders with measured edge separators; no other differences were accepted. [Exact source-operation proof](evidence/production-source-propagation.json).

All eight native propagation roles passed: color, padding, gap, all four corner radii, all four border widths, linked effect blur, shared text size and shared text line height. The actual consumer fields changed when the variable changed, and every original mode value and observed field was restored exactly in finally. [Before/during/after native evidence](evidence/native-token-propagation.json).

The initial strict import acceptance above precedes subsequent usability, imagery and additional-screen work. It is historical evidence, not acceptance of the latest source bundle. Library publication and cross-file consumer acceptance have not been performed.

## Subsequent usability and production-reference update

Managed browse pages now use `Library / …`; true component masters use `Source components / …`. All thirteen page identities were retained. A native repeat produced zero page or guide writes. [Page role repeat evidence](evidence/native-page-role-repeat.json).

Six approved real media fixtures are packaged offline with source provenance and content hashes. Native Figma decoded every exact repository JPEG; recreating each image from its bytes returned the same image hash. [Native decoder and reuse evidence](evidence/native-real-image-decoder.json). This verifies image resources, not yet their placement in every screen.

Before the image migration, twelve existing examples contained added inherited paint overrides. The repair restored only source-generated instances with closed, root-only authored overrides, preserved every native child identity, and verified every complete example against its original saved snapshot. No baseline replacement was used. [Exact repair evidence](evidence/source-inheritance-repair.json).

Twenty-two additional observed screen profiles, ten patterns and twenty-one real-image component variants are implemented in source. Their native import and screenshot comparison are in progress. The additional examples cover Notifications, Settings, Search, Help, Agentic Hub, empty Guidelines, loaded Libraries, Colors and empty Fonts; Marketplace is excluded. These remain editable static compositions. Synthetic entities and selected approved media do not establish complete production parity.
