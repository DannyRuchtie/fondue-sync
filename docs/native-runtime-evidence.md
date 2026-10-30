# Native runtime evidence — 2026-10-30

The updated [Figma library](https://www.figma.com/design/ZmOzqBnHNixUTV1TqRtBHs) contains 34 editable example screens: the twelve existing overviews plus 22 additional observed viewport/state profiles. Real photos appear inside the existing linked card covers and thumbnails. The [original file](https://www.figma.com/design/O5xq8vIIlxUCYXscYcNVww) is retained.

The plugin source is committed as `1e7087bf90d87848d9e1060271ba0528587bbe2b`. [CI passed all 170 tests, typecheck and build](https://github.com/DannyRuchtie/fondue-sync/actions/runs/41091996979); local formatting and diff checks also passed. The source remains pinned to Fondue 13.11.1, commit `ebcc9b8579a7f862f43a2732f5a5b9c3105e6796`.

## Library and plugin contents

- 444 variables: 384 released tokens and 60 explicitly labelled source-derived native constants; 51 shared styles.
- 420 icon families with 2,099 optical drawings; 218 component/pattern sets with 2,074 variants and 218 source guides.
- Six approved offline photos with provenance and content hashes; 112 authored image references. The photos are native image fills, while controls, text, vectors, palettes and functional illustrations remain editable.
- `Library / …` pages provide grouped browsing and concise adjacent guidance. `Source components / …` pages retain the actual editable masters. All thirteen managed page identities were preserved. [Native page-name repeat](evidence/native-page-role-repeat.json).
- Colors are grouped by semantic use and primitive hue ramps, with numerical shade ordering and linked Light/Dark samples. [Consumer-gallery review](evidence/consumer-gallery-review/README.md).

The final source bundle fingerprint is `697ddabeece5b587d0cab154c8dc75b822cb0d04243089fbaf092eb0b29ca1a8`; renderer revision is `74f68164bcd63b1a4da1e4d7f74bb1b3047c203a504a0a192d9007345a6cf7cc`.

## Visual and native acceptance

All 22 additional renders passed independent comparison with the supplied private references: viewport geometry, visible imagery, readability and clipping. The reviewed surfaces include Notifications, Settings, User menu, Help, Search, Agentic Hub, empty Guidelines, loaded Libraries, Colors and empty Fonts. Marketplace is excluded. [22-view acceptance matrix and PNGs](evidence/additional-examples/visual-review.json), [review notes](evidence/additional-examples/visual-review.md).

The twelve existing examples passed source-state guards and an actual image audit: 33 approved image fills, 212 text layers, zero Inter and zero unstyled text. Representative final Brands, Libraries, Guidelines and empty-library renders passed independent review. Existing main, example and compatible child identities were preserved. [Native audit](evidence/native-existing-image-audit.json), [visual acceptance](evidence/production-examples/real-photo-review.md), [Brands 1440px photo render](evidence/production-examples/brands-desktop-real-photos.png).

Native Figma decoded every exact repository JPEG; creating each image again from its bytes returned the same native hash. [Decoder/reuse evidence](evidence/native-real-image-decoder.json). The six original pattern migrations and twelve example updates completed through exact source approvals and saved-state guards. [Native update evidence](evidence/native-existing-image-updates.json). The approved removal migration rejects foreign children, journals interrupted changes, and restores source order using stable native identities.

Visual review found a shared-property defect: different variants could inherit another variant's text or icon defaults. The source audit identified 37 affected recipes. The renderer now shares equal defaults, retains the first public property key, scopes differing defaults, and resolves explicit overrides through the active variant. All 37 native repairs passed normal source updates with IDs retained. The mobile menu's four helper texts and four icons subsequently passed visual review. [Source collision audit](evidence/property-default-collision-source-audit.json), [current property coverage](component-property-coverage.json).

Twenty affected browse-gallery families were updated without conflicts. Packing moved section roots only. Thirty representative linked previews were checked; all twenty image fills matched their selected source mains, with no stale solid-paint pins.

## Variables and update behavior

Native before/during/after tests passed eight propagation roles: color, padding, gap, four corner radii, four border widths, shared effect blur, shared text size and shared line height. Original mode values and observed fields were restored exactly. [Propagation evidence](evidence/native-token-propagation.json).

Explicit source bindings retain their token identities. Other geometry mappings currently infer an equal value within the appropriate spacing, radius or border role; equality does not prove the original upstream dependency. Values absent from the exported scale use named source-derived constants. These mappings require review when upgrading the source scale. Fixed paths, viewport dimensions and image pixels retain their source geometry.

Diatype resolves to the installed ABC Diatype family; Cranny retains its family. Missing required faces block import rather than silently introducing Inter. Shared styles are applied as typography authority. The user-requested released ColorPicker.Input alignment was restored through an exact saved-state proof. [Alignment evidence](evidence/color-picker-alignment-restoration.json).

## Final consistency scope

All 1,385 source definitions, managed identities/types and current renderer stamps passed the final read-only comparison with zero source mismatches and zero remaining definition updates. [Final index receipt](evidence/native-final-index.json), [read-only repeat](evidence/native-final-definition-repeat.json). Exact cleanup removed 47 proven staging records; the persistent index and all sixteen asset shards remained byte-identical, and every page was preserved. [Cleanup evidence](evidence/native-final-cleanup.json). The bounded pass performed 870 actual asset snapshot checks. Renderer-only metadata adoption for source-identical entries preserves every saved snapshot string byte for byte; it neither accepts canvas drift nor replaces a baseline. Future inspection still compares actual state with those original snapshots. Any semantic source differences use an ordinary guarded update.

Acceptance covers static observed viewport/state compositions with fictional records and approved media, rather than live application behavior or full pixel parity. Agentic heading family and sizes are evidenced; its authored weight 400 remains unverified by computed-style evidence. Empty-library 768px/390px views have containment/readability acceptance rather than matching production references. The retained unmanaged cover's two text layers lack shared-style IDs and are excluded from generated-text claims. Publication and cross-file consumer acceptance have not been performed. Private production captures remain outside the repository.
