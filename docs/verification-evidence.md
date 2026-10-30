# Delivery verification evidence

Date: 2026-10-30 (Europe/Amsterdam).

## Released source and artifacts

- Fondue13.11.1 tag, commit `ebcc9b8579a7f862f43a2732f5a5b9c3105e6796`.
- Bundle fingerprint: `9b476d49d0d4a9192199f7b826d9c71dd50f886a5509f9ef5564d7d9ddd0d5e6`.
- Bundle SHA256: `b23e4ca8128067f8f2feb337fb57080901bcc08a4a8779c898588884b5211b76`.
- Built plugin JS SHA256: `736e139c8f3dcc802a7b4926c67bbfa5ff6240ada609d9d0869081d6b4ef9c96`.
- Snapshot lock verifies 3,840 source files before generation. Two consecutive generations produced byte-identical bundle and coverage artifacts. Npm integrity is registry reference metadata, not a claim of package-archive verification.

## Executed checks

- `npm run verify`: bundle generation, TypeScript check, **80 tests**, plugin build passed.
- `npm run format:check`: passed.
- Strict Plugin API model: full import and repeated sync passed; in-place source updates, native property defaults, local drift, missing assets, retained removals, example instances, metadata removal, native optical selection, mode-capacity failure/resume and recoverable SVG construction failure are covered.
- Independent review is recorded in [independent-review.md](independent-review.md).
- Browser evidence in [source-token-defects-browser.json](source-token-defects-browser.json) establishes actual inherited color behavior for missing released SCSS token names.

## Actual coverage

384 variables;33 styles;420 icon families with2,099 exact optical SVG variants;202 native component/pattern sets with1,992 source-profile variants;five authored product patterns;three editable example screens;202 documented sets,177 using released metadata. The catalog has10 supported finite entries,**42 partial entries**,and two nonvisual providers. Full original library acceptance remains open. See [coverage.json](coverage.json) and [gaps.md](gaps.md).

## Capacity and cost bounds

The strict model enforces100,000 UTF-8 bytes for namespace+key+value on every metadata write. Maximum observed entry:24055bytes. Largest full logical applied record:409812bytes. Assembled index:78515bytes, largest index shard:5902bytes. All round-trip without truncation. Head/chunk failure and corruption tests pass.

Modeled first import:34921 metadata writes/51437270 cumulative entry bytes; repeated sync:0writes. The model contains21449scene/metadata objects and1244managed assets. Real SVG expansion, native elapsed time, memory, collaboration traffic and file usability are not measured. See [metadata-capacity.json](metadata-capacity.json).

## Not executed

- Native development-plugin execution: user-selected manual destination is [PD Figma Sync](https://www.figma.com/design/O5xq8vIIlxUCYXscYcNVww/PD-Figma-Sync?node-id=0-1). The current development manifest is ready; the earlier automated test-file team choice is no longer needed. A read-only MCP session attempt was rejected for lack of edit access for the connected account (druchtie@gmail.com); no automated generation ran. This does not establish the permissions of the user’s desktop Figma account. Manual runtime results have not yet been reported.
- Native visual acceptance and actual override propagation: not run. API-model tests do not substitute for these.
- Publication/consumer acceptance: not run. The intended eligible Frontify workspace and permissions/entitlements are unverified; a personal Starter test would not prove this loop.
- Arbitrary hard-process interruption/global canvas transaction recovery: not proven. The engine preserves divergent/incomplete managed assets for review; metadata head atomicity does not span canvas allocations.
- Prototype export, live API runtime and reverse PR flow: future scope only; no live account data or credentials used.

Use the [native acceptance checklist](verification.md) after the relevant workspace/file is selected.
