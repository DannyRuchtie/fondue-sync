# Content-slot implementation checklist

Updated **6 November 2026**. Scope: the 21 families in [designer composition requirements](designer-composition-requirements.md). The original sample recipes are retained; editable counterparts are additive. Generated availability is a code check, not a publication claim.

## Family checklist

| Family | Generator / local workflow checks | Required regions | Main editable entry | Native / published consumer |
|---|---|---|---|---|
| components / Flyout | Complete | Content, Body, Actions | `components/Flyout.Editable` | Pending / Pending |
| components / SegmentedControl | Complete | Segments | `components/SegmentedControl.Root` | Pending / Pending |
| components / Table | Complete | Rows, Cells, Content, Header content | `components/Table.Root` | Pending / Pending |
| components / Accordion | Complete | Items, Content | `components/Accordion.Editable` | Pending / Pending |
| components / Box | Complete | Content | `components/Box.Editable` | Pending / Pending |
| components / Card | Complete | Banner content, Content, Actions | `components/Card.Editable` | Pending / Pending |
| components / Dialog | Complete | Body, Actions, Side content | `components/Dialog.Editable` | Pending / Pending |
| components / Dropdown | Complete | Items, Submenu items | `components/Dropdown.Editable` | Pending / Pending |
| components / Flex | Complete | Children | `components/Flex/row.Editable` | Pending / Pending |
| components / Grid | Complete | Rows, Cells, Content | `components/Grid.Editable` | Pending / Pending |
| components / Notice | Complete | Message content, Action | `components/Notice/controls-001.Editable` | Pending / Pending |
| components / OrderableList | Complete | Items, Content, Actions | `components/OrderableList.Editable` | Pending / Pending |
| components / RadioList | Complete | Options | `components/RadioList.Editable` | Pending / Pending |
| components / ScrollArea | Complete | Content | `components/ScrollArea/auto.Editable` | Pending / Pending |
| components / Section | Complete | Content | `components/Section.Editable` | Pending / Pending |
| components / Select | Complete | Options, Selected values | `components/Select.Editable` | Pending / Pending |
| components / Tabs | Complete | Triggers, Panels, Content | `components/Tabs.Editable` | Pending / Pending |
| components / Tooltip | Complete | Content | `components/Tooltip.Editable` | Pending / Pending |
| components / Tree | Complete | Nodes, Content, Actions, Children | `components/Tree.Editable` | Pending / Pending |
| rte / FloatingModalWrapper | Complete | Content | `rte/FloatingModalWrapper.Editable` | Pending / Pending |
| rte / Toolbar | Complete | Groups, Actions | `rte/Toolbar.Editable` | Pending / Pending |

## Verification steps

- [x] All 21 families expose every configured slot in every supported state, including collapsed/closed states. Legacy Surface sample variants are explicitly excluded from the slot-mode contract.
- [x] Insertion resolves a linked main for each of the 21 families.
- [x] Five-segment controls preserve linked items and coordinate one selected item.
- [x] Table headers and body cells expose content; column/row operations preserve existing cells and content, coordinate widths and reject uneven tables.
- [x] Radio selection clears the other options.
- [x] Tab insertion creates a trigger/panel pair; selection shows its matching panel; unequal pairs stop before changes.
- [x] Tree children/siblings remain linked nodes in their structural parent region.
- [x] Grid reflow moves existing linked cells, preserves their IDs/content and removes only emptied extra rows.
- [x] Stalled font discovery/loading stops before library mutations during preflight.
- [x] Local model checks: additive installation preserves customized foundations, component baselines and the global release marker, resumes interrupted slots, rejects renamed slots/missing foundations and creates nothing on repeat. Flyout, SegmentedControl and Table install before the remaining families.
- [ ] Complete the checkpointed native library update.
- [ ] Visually inspect and edit Flyout, SegmentedControl and Table first.
- [ ] Inspect all remaining families in native Figma, including long/empty content and collapsed-state changes.
- [ ] Verify recursive tree insertion and nested slots in native Figma.
- [ ] Accept a source/default update in a consuming file and verify custom content, order and nested links.
- [ ] Review and publish the library; verify normal Assets-based editing in a consuming file.

## Editing workflow

Choose **Sync → Compose with slots → Install missing editable components** to install missing mains after a recovery checkpoint. It reuses the existing native foundations and linked components without accepting unrelated drift or advancing the global release marker. Then use **Editable component → Insert editable component**. The picker covers all 21 families. Use native named-slot editing to add/remove/reorder arbitrary content and compatible linked parts. The Assets entry names use `/Editable` or their documented part names.

Use **Insert control**, **Add segment** and **Select segment** for segmented controls; **Add row / Add column / Match column width** for tables; **Add radio option / Select radio option** for single choice; **Add tab pair / Select tab pair** for matching panels; **Add tree child / Add tree sibling** for hierarchy; and **Add grid cell / Reflow grid** after choosing one to four grid columns.

Insert actions currently resolve this library file's managed assets. Native Assets insertion remains the consuming-file workflow. Editing helpers identify existing linked components by source identity. Published-consumer behavior remains a required acceptance step.

## Contracts and limits

The policy file records required slot names, variant conditions and preferred entry properties. It drives coverage and the insertion picker. Renaming/removing a slot or wrapping existing populated anatomy remains an explicit migration; the implementation does not detach or automatically convert old specimens.

Selection, paired tabs and grid/table edits are explicit designer actions, not simulations of application behavior. Figma slot layer-count limits are guidance. Table spans/sticky positioning, arbitrary CSS grid tracks, keyboard behavior, editor logic and live data remain runtime concerns. Tree recursion and other native behaviors are not certified by the local model tests.

See [native slot workflow](content-slots.md), [generated overview](composition-overview.md) and [composition policies](../recipes/composition-policies.json).

## Native status on 6 November

The normal **Update library** saved recovery version **Before Fondue update · 2026-11-06T13:14:48.216Z** (`2418737612941861688`). Fonts resolved, but comparison stopped the update before mutations because of **294 existing drift conflicts**, including customized chart colors and documentation. Those changes were preserved.

The additive installer was then implemented and checked locally. Native computer use could not start it: the previous plugin window remained stale, its controls did not respond and coordinate actions returned `noWindowsAvailable`, including after reconnecting computer use. The Figma application and other files were left open.

A read-only Figma connector check confirmed **1,388 managed assets**, the previous whole-file fingerprint, and no new editable recipe identities. Surface remains the previously installed exception. **No native installation, native visual acceptance or publication of these new families is claimed.** The next native step is **Install missing editable components**, followed by the unchecked acceptance steps above. See [recorded evidence](evidence/composition-slots-2026-11-06.json).
