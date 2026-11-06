# Content-slot implementation checklist

Updated **6 November 2026**. Scope: the 21 families in [designer composition requirements](designer-composition-requirements.md). The original sample recipes are retained; editable counterparts are additive. Generated availability is a code check, not a publication claim.

## Family checklist

| Family | Generator / local workflow checks | Required regions | Main editable entry | Native / published consumer |
|---|---|---|---|---|
| components / Flyout | Complete | Content, Body, Actions | `components/Flyout.Editable` | Installed; default checked / Pending |
| components / SegmentedControl | Complete | Segments | `components/SegmentedControl.Root` | Installed; default checked / Pending |
| components / Table | Complete | Rows, Cells, Content, Header content | `components/Table.Root` | Installed; default checked / Pending |
| components / Accordion | Complete | Items, Content | `components/Accordion.Editable` | Installed; default checked / Pending |
| components / Box | Complete | Content | `components/Box.Editable` | Installed; default checked / Pending |
| components / Card | Complete | Banner content, Content, Actions | `components/Card.Editable` | Installed; default checked / Pending |
| components / Dialog | Complete | Body, Actions, Side content | `components/Dialog.Editable` | Installed; default checked / Pending |
| components / Dropdown | Complete | Items, Submenu items | `components/Dropdown.Editable` | Installed; default checked / Pending |
| components / Flex | Complete | Children | `components/Flex/row.Editable` | Installed; default checked / Pending |
| components / Grid | Complete | Rows, Cells, Content | `components/Grid.Editable` | Installed; default checked / Pending |
| components / Notice | Complete | Message content, Action | `components/Notice/controls-001.Editable` | Installed; default checked / Pending |
| components / OrderableList | Complete | Items, Content, Actions | `components/OrderableList.Editable` | Installed; default checked / Pending |
| components / RadioList | Complete | Options | `components/RadioList.Editable` | Installed; default checked / Pending |
| components / ScrollArea | Complete | Content | `components/ScrollArea/auto.Editable` | Installed; default checked / Pending |
| components / Section | Complete | Content | `components/Section.Editable` | Installed; default checked / Pending |
| components / Select | Complete | Options, Selected values | `components/Select.Editable` | Installed; default checked / Pending |
| components / Tabs | Complete | Triggers, Panels, Content | `components/Tabs.Editable` | Installed; default checked / Pending |
| components / Tooltip | Complete | Content | `components/Tooltip.Editable` | Installed; default checked / Pending |
| components / Tree | Complete | Nodes, Content, Actions, Children | `components/Tree.Editable` | Installed; default checked / Pending |
| rte / FloatingModalWrapper | Complete | Content | `rte/FloatingModalWrapper.Editable` | Installed; default checked / Pending |
| rte / Toolbar | Complete | Groups, Actions | `rte/Toolbar.Editable` | Installed; default checked / Pending |

## Verification steps

- [x] All 21 families expose every configured slot in every supported state, including collapsed/closed states. Legacy Surface sample variants are explicitly excluded from the slot-mode contract.
- [x] Insertion resolves a linked main for each of the 21 families.
- [x] Five-segment controls preserve linked items and coordinate one selected item.
- [x] Table headers and body cells expose content; column/row operations preserve existing cells and content, coordinate widths and reject uneven tables.
- [x] Radio selection clears the other options.
- [x] Tab insertion creates a trigger/panel pair; selection shows its matching panel; unequal pairs stop before changes.
- [x] Tree children/siblings remain linked nodes in their structural parent region.
- [x] Grid reflow moves existing linked cells, preserves their content and removes only emptied extra rows. Native Figma can rebase descendant IDs when slot defaults become customized.
- [x] Stalled font discovery/loading stops before library mutations during preflight.
- [x] Local model checks: additive installation preserves customized foundations, component baselines and the global release marker, resumes interrupted slots, rejects renamed slots/missing foundations and creates nothing on repeat. Flyout, SegmentedControl and Table install before the remaining families.
- [x] Install all missing editable compositions after a confirmed recovery checkpoint.
- [x] Visually inspect and edit Flyout, SegmentedControl and Table first.
- [x] Insert and inspect linked default examples for all 21 families in native Figma.
- [x] Audit every required slot across 635 matching source variants, including closed/collapsed states.
- [x] Verify three-level tree insertion, hidden tab panels and nested content slots in native Figma.
- [x] Verify custom table content survives the responsive cell-main update, with main/child IDs retained.
- [x] Repeat the Flyout and Table installer runs: zero created nodes and zero resumed components.
- [ ] Complete long/empty content and variant-change acceptance in ordinary consuming files.
- [ ] Accept a source/default update in a consuming file and verify custom content, order and nested links.
- [ ] Review and publish the library; verify normal Assets-based editing in a consuming file.

## Editing workflow

Choose **Sync → Compose with slots → Install missing editable components** to install missing mains after a recovery checkpoint. It reuses the existing native foundations and linked components without accepting unrelated drift or advancing the global release marker. Then use **Editable component → Insert editable component**. The picker covers all 21 families. Use native named-slot editing to add/remove/reorder arbitrary content and compatible linked parts. The Assets entry names use `/Editable` or their documented part names.

Use **Insert control**, **Add segment** and **Select segment** for segmented controls; **Add row / Add column / Match column width** for tables; **Add radio option / Select radio option** for single choice; **Add tab pair / Select tab pair** for matching panels; **Add tree child / Add tree sibling** for hierarchy; and **Add grid cell / Reflow grid** after choosing one to four grid columns.

Insert actions currently resolve this library file's managed assets. Native Assets insertion remains the consuming-file workflow. Editing helpers identify existing linked components by source identity. Published-consumer behavior remains a required acceptance step.

## Contracts and limits

The policy file records required slot names, variant conditions and preferred entry properties. It drives coverage and the insertion picker. Renaming/removing a slot or wrapping existing populated anatomy remains an explicit migration; the implementation does not detach or automatically convert old specimens.

Selection, paired tabs and grid/table edits are explicit designer actions, not simulations of application behavior. Figma slot layer-count limits are guidance. Table spans/sticky positioning, arbitrary CSS grid tracks, keyboard behavior, editor logic and live data remain runtime concerns. Three-level tree recursion has been checked natively; published-consumer acceptance remains separate.

See [native slot workflow](content-slots.md), [generated overview](composition-overview.md) and [composition policies](../recipes/composition-policies.json).

## Native status on 6 November

The normal **Update library** saved recovery version **Before Fondue update · 2026-11-06T13:14:48.216Z** (`2418737612941861688`). Fonts resolved, but comparison stopped the update before mutations because of **294 existing drift conflicts**, including customized chart colors and documentation. Those changes were preserved.

The desktop plugin then saved **Before Fondue update · 2026-11-06T13:56:06.810Z** (`2418747786667592236`). Its first additive preflight found an overly strict check of a reused Button's internal layers. That check now treats canonical dependencies as opaque linked components while retaining identity, variant and new-slot checks. The regression test covers a Button with its original icon removed.

The repaired shared generator was run through the Figma connector in family-sized batches, reusing that confirmed recovery version. It installed **58 component sets across all 21 required families**. The native audit checked **635 matching variants** with no missing required slots. The ledger now has **1,446 managed assets**; the previous whole-file fingerprint is preserved. The two responsive table-cell mains were updated only after their exact saved snapshots matched; no source node IDs were replaced.

Native editing checks passed for five linked segments and single selection, Flyout content containing a linked Notice, a five-row/four-column table with coordinated widths and preserved custom content, four radio options with one selected, three tab/panel pairs with one visible panel, three-level Tree composition, and an eight-cell Grid reflowed from two to four columns without losing custom content. Hidden-region traversal and grid slot materialization are covered by the repaired helpers.

Open [core workflows](https://www.figma.com/design/ZmOzqBnHNixUTV1TqRtBHs?node-id=222-7153) or [the other 18 families](https://www.figma.com/design/ZmOzqBnHNixUTV1TqRtBHs?node-id=228-7338) in Figma. These are linked review examples in **Library / Examples**.

The unrelated full-update drift remains preserved. **No publication or published-consumer update acceptance is claimed.** See [recorded evidence](evidence/composition-slots-2026-11-06.json).
