# Native sections and adjacent documentation

Consumer pages group each component family in a native Figma Section. Components, Charts, Rich text and Product patterns keep their own pages. Each Section contains real native instance previews, friendly profile labels and one concise family guide. The guide explains purpose, usage and represented controls without repeating the same coverage paragraph for every profile.

A preview starts with the exact first represented source configuration. This is explicitly labelled as representative; it does not assert that the configuration is the React default. Supported native properties remain editable. Icons use the exact 24px optical source. Source geometry and typography are not rescaled to fit a gallery tile.

Detailed main sets and their full profile guides live on corresponding **Library masters** pages. Main component, variant, child and guide IDs are preserved. Figma descriptions and source links remain on the native definitions. Moving masters removes their editor outlines and long variant names from the consumer browsing pages without detaching previews.

The **Colors** page groups semantic roles by purpose, with usage guidance and exact Light/Dark mode previews. Primitive ramps are grouped by hue and ordered numerically, including shade 100 after 95. Effect implementation colors are separate. Every sample uses the source variable; presentation typography uses shared styles. Auto Layout padding, gaps, borders and radii bind to exact source variables or explicitly documented source-derived constants.

Examples retain full-size screen Sections with adjacent source-backed captions. They remain editable compositions with connected native instances.

## Identity and recovery

Ownership comes from stable ledger keys, never a matching displayed name. The ledger records Sections, presentation nodes and preview instances. A missing or changed managed identity stops generation rather than creating a duplicate. A preview swapped to an unrelated source is preserved and reported as a conflict. A changed first source variant requires an explicit migration.

Before reparenting any main or detailed guide, the organizer records an exact-ID move audit. Repeated generation reuses existing nodes. It does not detach instances, rename source variants or overwrite variant overrides. Source assets continue to use the engine's applied-snapshot drift checks.

Sections position the gallery and guide. Their inner content uses Auto Layout and measures actual source bounds. Unrelated page nodes stay in place; generated sections start below them. Local documentation edits are preserved and reported. The automated organizer does not delete empty previous pages.

## Verification

`tests/galleries.test.ts`, `tests/colors.test.ts` and `tests/documentation.test.ts` cover grouping, numeric shade order, native modes and aliases, exact optical selection, concise copy, identity preservation, drift rejection, fresh installation, exact-ID move audits, token-responsive layout and repeated generation. `tests/sections.test.ts` covers the screen Section organizer. The full released-bundle API model checks initial import and a repeat with zero additional writes.

These tests establish model behavior. Actual native migration and visual evidence are recorded separately in [native runtime evidence](native-runtime-evidence.md).
