# Production layout reference for authored examples

The overview examples use read-only inspection of the current application on 2026-10-30 as a layout reference. Their text, entity data, counts and geometric artwork remain fictional. Production images, avatars, account identifiers and raw screenshots are excluded from this repository. Released Fondue remains the sole source for component, icon and token definitions; production inspection informs only the authored screen composition.

## Observed page structure

The Brands overview contains an Overview header with a right-aligned creation action, a full-width search row, and a card grid. It does not use the earlier illustrative hero/statistics composition.

The Guidelines overview uses a brand-context navigation rail, header and creation action, then a search/sort/view toolbar and guideline cards. Library overview shares that shell and adds header-level Overview, Remote assets and Shared folders navigation. Both populated and empty library states were observed. A populated library overview uses cards, rather than the asset-detail grid previously implied by the illustrative example.

Opening a brand from Brands overview led to its Guidelines overview. A separate brand-home layout was not established by that navigation, and the examples do not invent one.

## Measured viewport profiles

| Property | 1920 px desktop| 1440 px desktop| 390 px narrow|
|---|---|---|---|
| Navigation |256 px left rail plus 1 px boundary|Same|68 px fixed bottom brand bar|
| Main start |x 257, y 60|x 257, y 60|x 0, y 96|
| Grid start |x 281, y 138|x 281, y 138|Brands x 24, y 174; Guidelines/Libraries x 24, y 218|
| Grid columns |5 columns, about 310.2 px each|4 columns, 271.75 px each|1 column, 342 px|
| Column gap |16 px|16 px|Not applicable|
| Brand/library card |About 310.2 x 219.1|271.75 x 199.875|342 x 235|
| Guideline card |About 310.2 x 211.1|271.75 x 191.875|342 x 227|

Card banners maintain 2:1 geometry with 8 px radius. Brand/library footers are 64 px high and include a 40 px thumbnail or icon. Guideline footers are 56 px high. Source card titles are 14 px/16 px and descriptions 13 px/16 px. Desktop content inset is 24 px.

The left rail remains visible at 1024 px and 768 px. At 768 px, the library header's final navigation entry moves into an overflow control. These are observations at the tested widths, not a declaration of the exact CSS breakpoint thresholds.

## Typography and empty states

Production body/control typography uses the released Diatype stack; native examples resolve the exact available ABC Diatype faces. Library empty-state display typography is Cranny Light 46 px/54 px. The body is 14 px/18 px with a 470 px desktop maximum width. The primary action is 36 px high with 14 px medium text and 4 px radius; the help link is 12 px/16 px.

The empty panel is a large warm-neutral rounded surface containing an illustration, display heading, explanatory body, primary action and help link. The example illustration is original editable geometry inspired by the observed arrangement of two tilted asset cards over pale tiles. It is not a copied production image or a claim of exact illustration parity.

## Narrow-layout limit

At 390 px, the observed Guidelines/Libraries sort/view controls overlapped the top of the card/panel by about 12 px. This is recorded as a production limitation, not a recommended interaction. Native example documentation must identify whether it preserves that observed overlap or deliberately corrects it. A static narrow composition does not establish complete responsive or runtime parity.

The browser viewport override was reset after inspection. The examples remain static native compositions; authentication, live searching, sorting, account data and production actions are not connected by this work.
