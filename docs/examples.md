# Patterns and example screens

Fondue Sync includes five authored reusable patterns and three editable example screens. The patterns use nested instances of generated Fondue main components. Screens compose those patterns as instances inside ordinary editable frames. They are starting points for design work, using the same published library workflow as individual components.

## What is included

| Pattern | Variants | Intended reuse |
| --- | --- | --- |
| NavigationShell | Overview, Guidelines, Agentic hub | Workspace sidebar with real buttons and search input |
| SearchToolbar | brands, guidelines, assets | Search, filter and sort shell |
| AssetBrowser | brands, assets | Typed fixture-backed browser with native cards |
| GuidelinesEmptyState | empty | Guideline creation starting point |
| AgenticFeatureGrid | ready | Feature overview cards and actions |

The Dashboard screen composes a workspace sidebar, header, search toolbar and brand browser. The Guidelines screen composes the sidebar, search/sort shell and empty state. The Agentic hub screen composes a header, automation feature, feature grid and learning cards.

`explorer/SOURCE.md`, `ProductViews.tsx`, `ProductPages.tsx` and `product-views.css` were inspected as composition references. The playground records inspections of Dashboard, Guidelines and Agentic hub on 2026-10-28. It does not contain an implemented Marketplace page: its sidebar link is not evidence of a Marketplace layout. No Marketplace screen is claimed or generated.

The playground is **not** used for Fondue component definitions. Every nested core component resolves against the pinned released source bundle. Patterns are explicitly authored Fondue Sync compositions, separated from public Fondue component exports. Examples intentionally use synthetic names, original native geometric artwork and fictional data. The playground's reference CDN images, account imagery, notification fixtures and usage values are excluded.

## Designer workflow

1. Import the Fondue library. The release bundle includes authored patterns and example screens.
2. Inspect the Patterns and Examples pages. Publish patterns through Figma's ordinary library publication flow when ready.
3. In a design file, enable the published library and insert a pattern. Its nested controls remain real Fondue instances with source-supported properties.
4. Duplicate an example frame as a layout starting point. Change instance properties and text. Keep library linkage when replacing controls.
5. Compare and update the source library on a new release, publish it and accept updates in consumer files using Figma's normal workflow.

The examples are static editable compositions. Buttons do not create brands, search inputs do not query accounts and sidebar controls do not navigate a live application. Real connected prototype generation remains a later phase.

## Fixture and binding contract

`fixtures/demo.json` owns a stable synthetic dataset named `fondue-sync-demo-v1`. It contains brands, a library, assets with view/download permissions and custom metadata, an empty guidelines collection, fictional Agentic features and learning cards. No credentials or live identifiers appear in it.

A managed layer may carry a `dataBinding` object following `fixtures/bindings.schema.json`:

```json
{
  "schemaVersion": 1,
  "dataset": "fondue-sync-demo-v1",
  "domain": "assets",
  "entityId": "asset-poster",
  "field": "name",
  "type": "string",
  "status": "fixture"
}
```

The contract identifies intended content and interaction slots. `componentName` plus `variantProps` selects an actual generated native variant. An exact `recipeId` selects a reusable pattern. `text` overrides an exposed native text property; overrides never detach the instance. No query is performed by this metadata.

`fixtures/capabilities.json` sketches the future connector boundary. Each request carries explicit approval and scopes, preferred locale, route, selection and search context. Responses distinguish loading, ready, empty, error, permission-required and unavailable states and carry cursor paging metadata. Future capabilities cover brands, library browsing, asset search and guideline navigation/content search. Their status is **future-connected**; no adapter or API execution is implemented here.

Future adapters must preserve search/filter/sort while paging, respect permissions/custom metadata, handle search indexing delay and verify beta guideline API availability before use. Recents, favorites, notifications, usage and Agentic execution parity are explicitly unclaimed. Connecting a real account requires separate user authorization and a reviewed adapter; importing the library provides neither.

## Update boundaries

Patterns have stable IDs (`patterns/NavigationShell`, for example), and example screens have separate IDs (`examples/dashboard`). Changing fixture copy is a source change to authored examples. Sync compares managed definitions and snapshots before patching. Native child instance linkage and supported overrides follow the sync engine's preservation rules; local managed edits may require conflict resolution. These contracts do not promise migration across arbitrary structural changes or future API schemas.
