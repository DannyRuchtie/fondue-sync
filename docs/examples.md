# Production-grounded patterns and example screens

The original eight authored reusable patterns and twelve editable screen compositions cover the application’s Brands, Guidelines and Libraries overviews. They remain active alongside the additional product surfaces documented below. The [sanitized production layout reference](production-layout-reference.md) records observed structure and viewport measurements. Component, icon and token definitions still come exclusively from the pinned Fondue release.

Patterns use nested instances of generated native Fondue assets. Screens compose those patterns inside editable frames. Their names, entity data and counts are fictional. Image-content slots use approved real media with source provenance; private viewport screenshots, private actor identities and live service connections are excluded. Production inspection informs layout, not component ownership or runtime behavior.

## Included patterns

| Pattern                       | Profiles                                             | Purpose                                                                            |
| ----------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| ProductionNavigationRail      | Brands, Guidelines, Libraries, library-empty context | Desktop account/brand navigation shell                                             |
| ProductionMobileBrandBar      | Same four page contexts                              | Observed fixed bottom navigation at narrow width                                   |
| ProductionPageHeader          | Three pages across four viewport profiles            | Page title, creation action and library-level navigation                           |
| ProductionSearchToolbar       | Three pages across four viewport profiles            | Observed search, sorting and card/list controls                                    |
| ProductionBrandCard           | Two synthetic brands across three viewport profiles  | Brand banner and thumbnail/title footer                                            |
| ProductionGuidelineCard       | Three viewport profiles                              | Guideline banner, title and page-count footer                                      |
| ProductionLibraryCard         | Three viewport profiles                              | Library banner, icon, title and fictional asset-count footer                       |
| ProductionLibrariesEmptyState | Four viewport profiles                               | Empty panel with original editable artwork, display title, explanation and actions |

There are 48 authored pattern variants. These counts describe reusable composition recipes; they are not additional public Fondue component exports. The generated coverage report records the active bundle totals.

## Included screens

Brands overview, populated Guidelines overview and populated Libraries overview each have measured 1920 px, 1440 px and 390 px compositions. Libraries empty state has 1920 px, 768 px and 390 px compositions. The 768 px sample uses a 960 px authored screen height; production inspection verified the corresponding navigation structure at 768 px width with a 900 px viewport. It is not a claim that every height-dependent measurement was inspected at 960 px.

The desktop examples reproduce the observed navigation rail, page header, full-width search/toolbar row and card density. Cards are not a universal 310 px width: the observed 1920 px grid has five columns around 310.2 px, whereas 1440 px has four columns at 271.75 px. The narrow examples use a bottom brand bar and a single 342 px card column.

Opening a brand from Brands overview led to its Guidelines overview. A separate brand-home screen was not established by that navigation. The earlier illustrative Agentic hub, hero/statistics layouts and asset-browser interpretation of library overview are not active production-grounded examples. Older illustrative compositions are archived source, not an assertion of current product parity.

The empty-state display heading uses Cranny Light at the released 46 px/54 px role. Body and controls use the released Diatype roles with the available exact ABC Diatype face mapping. Illustration geometry remains native and editable, with approved real photography in image-card regions. Those media substitutions are explicit and do not claim exact application illustration imagery.

## Observed responsive limitation

At 390 px, production Guidelines/Libraries sort/view controls extended about 12 px into the content region. These authored narrow compositions preserve and label that observation. They do not silently turn an observed product limitation into a claim of polished mobile parity. The measured viewport profiles do not establish every CSS breakpoint threshold or all responsive states.

## Designer workflow

1. Import the library and inspect its native Patterns and Examples sections with adjacent usage guidance.
2. Publish reviewed patterns through Figma's ordinary library publication flow.
3. In a design file, enable the published library and insert a pattern. Its nested controls remain connected native instances with supported source properties.
4. Duplicate an example frame as a starting layout. Change text, instance properties and fictional content; preserve library linkage when replacing controls.
5. Compare and update the source library on a new release, review changes, publish and accept updates in consumer files through Figma's normal workflow.

Buttons do not create brands or libraries, search inputs do not query accounts, and navigation controls do not open a running application. These are static editable compositions. Connected prototype generation remains a later phase.

## Fixture and binding contract

`fixtures/demo.json` owns the synthetic dataset `fondue-sync-demo-v1`. Active examples use fictional brands, a guideline and a library with fixture-backed asset counts. The broader fixture includes asset view/download permissions and custom metadata for future connected-prototype work. No credentials or live account identifiers appear in it.

A managed layer may carry `dataBinding` metadata following `fixtures/bindings.schema.json`:

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

`componentName` plus `variantProps` selects a native Fondue variant; an exact `recipeId` selects an authored pattern. Supported native text properties provide editable content without detaching instances. Binding metadata identifies intended content and interaction slots; it does not execute a query.

`fixtures/capabilities.json` describes a future connector boundary, including explicit approval/scopes, locale, route, selection/search context, cursor paging and loading/ready/empty/error/permission-required/unavailable states. No adapter or API execution is implemented here. Future adapters must preserve search/filter/sort while paging, respect permissions/custom metadata, handle indexing delay and verify beta guideline API availability. See [connected prototypes](connected-prototypes.md).

## Update and validation boundaries

Patterns use stable identities such as `patterns/ProductionNavigationRail`. Screens use separate identities such as `examples/production-brands-populated-desktop`. Fixture or composition changes are source changes to authored examples. Sync compares managed definitions and snapshots before applying compatible changes; arbitrary structural rewrites may require migration.

Production observation, local bundle/sync tests, native Figma import, visual acceptance and cross-file library update acceptance are separate evidence levels. A production-grounded recipe does not prove pixel parity until its native output has been reviewed at the corresponding viewport. Refer to the native evidence record for completed canvas checks and remaining limitations.

## Additional observed product surfaces and real image content

The original eight pattern families and twelve screen IDs remain stable. Ten additional authored pattern families provide22 more observed profiles: Notifications, User menu, Account settings, Help, blank/results Global Search, Agentic hub, empty Guidelines, loaded Libraries, Essentials palette accordions/expanded table and Fonts-empty. Marketplace is excluded. See the [sanitized additional layout reference](additional-production-layout-reference.md) for the measured profiles, narrow overflow constraints, typography evidence and image-slot audit.

The active image-content regions now use approved real Frontify media through the offline [image manifest](../fixtures/media/manifest.json). Native banner/thumb roots keep their identities; original invented banner artwork and initial children require an explicit guarded migration before removal. Empty illustrations and the automation diagram retain native editable geometry, with actual photography only in their image-card regions. Functional icons, document previews, font specimens, token swatches and chart data retain their source semantics. Fixture identities and text remain fictional; media source names and acquisition provenance remain in the registry.

The additional source examples do not imply that new native imports, visual acceptance or interactions have already passed. Agentic font weight still requires the specifically recorded computed-style confirmation; missing source fonts must block instead of falling back to Inter.
