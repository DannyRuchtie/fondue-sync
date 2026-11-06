# Native content slots

## Designer workflow

Use **Overlays / Flyout / Surface** with **contentMode = slot**. Select the **Content** slot and insert, duplicate, remove or reorder layers and component instances. Edit nested components through their own properties. The surrounding Surface remains a linked library instance, including its shadow and corner-radius variants.

The initial text is default example content. It can be replaced in an instance. The source recipe's 16px padding remains the specimen's content spacing, not a newly introduced React prop.

Existing Surface variants retain their original main/child IDs and text property, exposed as **contentMode = sample**. Nine additive slot variants cover the same shadow/corner combinations. Changing from sample to slot is an explicit choice; copy any existing custom text before switching. An isolated Figma experiment lost its text override when an existing default was reparented into a slot, so the implementation deliberately avoids that automatic conversion.

`contentMode` is a Figma composition property, not a Fondue React prop. The generator includes editable compositions for all 21 required families in the [implementation checklist](slot-implementation-checklist.md). Original specimens remain intact; editable entries are additive.

### Installing and inserting editable components

Open **Sync → Compose with slots → Install missing editable components**. This saves a recovery version, checks existing dependencies and fonts, and installs missing editable mains and their required linked parts. It reuses existing foundations and components without replacing their content or accepting local drift. An interrupted installation can resume its saved, unedited partial components in place.

This action leaves the whole-file release fingerprint unchanged. It does not resolve unrelated update conflicts, populate every gallery, or publish the library. Missing native foundations, incompatible existing anatomy and edits to a partial installation stop the action with an explanation.

Choose a family under **Editable component**, then **Insert editable component**. Designers can use native slot editing to insert, remove and reorder layers and linked components. The picker inserts from this library file; published Assets are the normal consuming-file insertion route.

### Flyouts and dialogs

Use the editable Flyout for **Body** and **Actions** regions while preserving the header, close control and surrounding shell. Editable Body and Footer parts are also available independently. Surface retains its separate **Content** slot. Dialog adds an optional **Side content** region; enable its `sideContent` property before editing that region.

Replace the default body with the actual fields, lists or linked components needed for the design. The nested components retain their own properties and library links.

### Segmented controls

After updating the library, open **Sync → Compose with slots**, enter a count (2–10), and choose **Insert control**. This creates a linked `SegmentedControl/Root` containing linked `SegmentedControl/Item` instances in its native **Segments** slot. Select the control or something inside it and use **Add segment** to append an item. Select an individual item and use **Select segment** to make it the only selected item.

Native slot editing also supports inserting, deleting and reordering items. Edit labels, icon swaps, selected state, disabled state and icon-only mode on the nested Item. Keep disabled and icon-only settings consistent across the group. Figma slot layer-count limits are guidance, so manual editing can still produce an invalid selection or count. The pinned runtime indicator stylesheet supports at most ten segments.

Original two-item specimens keep their existing IDs. The editable Root and Item are new components, so existing custom instances are not automatically converted. Count is content rather than an extra variant axis. Keyboard navigation, interactive group state and animated selection remain runtime behavior.

### Tables

Choose **Insert table** for a linked table with three columns, one header and three body rows. The composition has three boundaries: `Table/Root` → **Rows**, `Table/EditableRow` → **Cells**, and `Table/ContentCell` → **Content**. The default custom-header composition uses linked `Table/ContentHeaderCell` parts with **Header content** slots and a library-owned sort indicator. The original text-header composition remains available.

- Select the table, a row or a cell and choose **Add column** to append one linked cell to every row. Existing cells and their content stay in place.
- Choose **Add row** to append a body row with the current column count and widths.
- Resize a cell, select it or a layer inside it, and choose **Match column width** to apply that width across its column and resize the table.
- Place arbitrary text or linked components inside a body cell's Content slot using Figma's native editing.

Column actions require equal cell counts and aligned widths. They stop with an explanation when the table is uneven or contains unknown row/cell components. Editable body/header cells use Fill for their library-owned content frames and borders, so those parts follow the resized column. Native editing remains available for manual repair. Width matching is an explicit action; it is not a live spreadsheet or shared-width variable system. Spans, sticky columns, sorting, selection interactions and accessibility semantics are runtime concerns. Existing Table specimens remain intact.

Insertion currently resolves the library file's managed assets. Editing an existing composition uses its linked source identities. Published-library consumer use and native nested-slot behavior still need acceptance checks before publication.

### Lists, navigation and layout

- Accordion exposes **Items** and per-item **Content**; closed items retain their hidden content region.
- Dropdown and Select expose repeatable **Items / Options**, grouped options and submenu items. Multiple Select also exposes **Selected values** using linked value parts.
- RadioList exposes linked **Options**. **Add radio option** and **Select radio option** coordinate a single selected option.
- OrderableList exposes **Items**, with per-item **Content** and **Actions**, while retaining the drag handle.
- Tabs exposes **Triggers** and **Panels**, with per-panel **Content**. **Add tab pair** creates both linked parts; **Select tab pair** shows the matching panel. Unequal pairs stop before changes.
- Tree exposes **Nodes** and per-node **Content**, **Actions** and **Children**. **Add tree child / sibling** preserves the hierarchy and expands a parent when adding a child. Native checks cover three linked levels, including insertion into a collapsed node.
- Grid exposes **Rows**, **Cells** and cell **Content**. Choose one to four columns and use **Reflow grid**; it moves existing cells without resetting their content. **Add grid cell** appends a linked cell. This is a row-major Figma adaptation, not arbitrary CSS grid tracks or spans.
- Box, Section and ScrollArea expose **Content**; Flex exposes **Children**. ScrollArea keeps its fixed viewport and clipping.
- Card exposes **Banner content**, **Content** and **Actions**. Notice exposes **Message content** and a single **Action**. Tooltip and the rich-text FloatingModalWrapper expose **Content**. The rich-text Toolbar exposes **Groups** and per-group **Actions**.

Selection and structural helpers perform explicit design edits. They do not simulate keyboard interaction, application state, editor behavior or live data.

## Composition overview and maintenance

**Sync → Component composition overview** is a searchable view of the bundled source inventory, authored recipe slots and [composition policies](../recipes/composition-policies.json). The generated [overview](composition-overview.md) covers all source families. “Available” means required slot recipes exist in the generator; it does not mean the open file is synchronized or the library published.

Maintain recommendations, required recipe IDs, slot names and preferred insertion properties in `recipes/composition-policies.json`; maintain implementation in the recipes. Coverage checks every relevant variant, including hidden regions. Run `npm run bundle` after changes. A new source family appears as **Needs review** when the inventory is rebuilt against that source release. Missing recipes show **Needs slots** or **Partly available**, rather than disappearing. Policy entries for planned or removed source components remain visible as **Not in source**. The current overview UI is read-only and links to the versioned policy file; an in-plugin policy editor and a live per-family Figma reconciliation are not implemented.

All 21 required families now have generator definitions. Primitives continue to use text, boolean, variant and swap properties where those express their anatomy; chart marks and editor documents are data-driven. The three conditional chart helpers remain a product decision rather than automatically receiving arbitrary-content slots.

## Repository contract

Recipes can declare `contentSlot` on a component-owned frame:

```js
contentSlot: {
  id: "content",
  name: "Content",
  description: "Add and arrange content here.",
}
```

Optional `minChildren` and `maxChildren` describe nonnegative layer-count guidance. These are Figma guidance, not strict runtime enforcement. Preferred-component lists and a registry editor are not implemented by this change. Explicit `layoutSizingHorizontal`/`layoutSizingVertical` use native `FIXED`, `HUG` or `FILL` after parenting and resizing.

The renderer creates a real native SlotNode inside the frame. Logical child IDs stay independent of that wrapper. Recipe children are the main component's default content. Text/icon properties below the boundary are not exposed through the outer component; nested components retain their own property APIs.

Sync renders library mains and their defaults. It never calls `resetSlot()` or rebuilds an instance's customized contents. Library main/default edits remain subject to ordinary drift protection; slot contents in a managed authored pattern are not silently exempted from conflict review. Ordinary consumer instances receive native Figma library updates.

Slot creation uses `ComponentNode.createSlot()`. Variant slots share one property on the owning component set. Slot removal, identity/name changes, and adding a slot around existing content require explicit migration. A failed first import can resume a tagged partial slot without replacing its identity.

## Historical native verification on 2 November 2026

- Local engine tests cover shared properties across variants, default updates, preservation of customized instance contents, repeat inspection and interrupted-import recovery.
- The live review file received a targeted Surface migration using the shared slot helper, after saving **Before Surface content slots** in Version History and confirming the saved Surface baseline matched.
- The original nine mains remain; nine slot variants were added within the same managed set. The set's applied definition/snapshot was updated; the whole-file release fingerprint was not advanced.
- Repeating the targeted migration created and changed no nodes.
- Native tests preserved two custom text blocks across shadow/corner variant changes and preserved the main-component link of a Button placed inside a slot. Temporary test instances were removed.
- The existing Surface gallery instance uses slot mode. A screenshot confirmed its appearance remains intact.

These native checks do not substitute for a full Import/Update run with the rebuilt desktop plugin, published-library consumer acceptance, or version-history restoration testing. No library publication was performed.

The SegmentedControl/Table additions pass local engine tests for five linked items, coordinated selection, adding a column to every row, copying widths, adding rows, preserving existing content, stopping on uneven tables, and leaving library mains unchanged. The rebuilt desktop plugin loaded with 223 component sets. Figma confirmed a recovery version, but native font preflight remained pending at Diatype Regular, including after resolving the reviewed installed alias before loading. The waiting plugin was closed before library mutations. Native SegmentedControl/Table layout and nested-slot acceptance remain open; no full update or publication was completed.

That attempt's confirmed recovery version was **Before Fondue update · 2026-11-02T13:14:59.134Z**, ID `2417262161780541804`. Source-font checks and asset comparisons report progress. The loader checks Figma's available families before loading the reviewed ABC Diatype alias; it never substitutes an unrelated font. See [desktop evidence](evidence/composition-slots-2026-11-02.json). Current implementation and acceptance status are tracked in the [checklist](slot-implementation-checklist.md).

## Current implementation status on 6 November 2026

The repository implements all 21 required families, including the structured editing helpers and the additive installer. Local checks cover insertion of every family, state coverage for required slot names, preservation of consumer content during coordinated edits, and safe installation/retry behavior.

All 21 required families are now installed in the live library. The targeted runs added 58 sets and preserved the existing whole-file marker and unrelated drift. A native audit checked the required slots across 635 matching source variants; linked default examples for every family are available in **Library / Examples**. The native core checks include custom content surviving the responsive table-cell main update.

The installer reuses canonical components without requiring their private anatomy to match the latest recipe. Editing helpers temporarily include invisible instance children so closed regions and paired panels remain discoverable, then restore the caller's setting. Grid reflow tracks content order and resolves fresh slot children after mutations rather than relying on old descendant handles.

Open [core workflows](https://www.figma.com/design/ZmOzqBnHNixUTV1TqRtBHs?node-id=222-7153) or [all other editable families](https://www.figma.com/design/ZmOzqBnHNixUTV1TqRtBHs?node-id=228-7338). Normal full-file updating still requires review of the 294 unrelated local conflicts. Publication and published-consumer acceptance remain pending; see the [checklist](slot-implementation-checklist.md) and [current evidence](evidence/composition-slots-2026-11-06.json).
