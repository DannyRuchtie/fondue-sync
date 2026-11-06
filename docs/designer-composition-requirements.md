# Designer composition requirements

Reviewed **6 November 2026** against the locally bundled **Fondue 13.11.1** inventory: **54 component families** across components, charts and rich text. Variants and compound parts are grouped under their family; the updated bundle contains 276 component sets.

The goal is that a designer can build a realistic screen with linked library instances: add the segments they need, arrange their own list items, and put the appropriate form or components inside a flyout. They should be able to do this without detaching the surrounding component.

This requirements overview is based on the current source anatomy and designer workflows. It covers **21 families that need editable composition when offered as linked containers**, **3 chart helpers needing a composition/data decision**, and **30 families served by properties, data or runtime configuration**. All 21 required families are implemented and installed in the live library. Native checks cover linked insertion, required slot regions in 635 matching source variants and the structured editing helpers. See the [implementation checklist](slot-implementation-checklist.md) for the separate code, native and published-consumer status.

## Recommended approach

Use a shared composition contract for each family, with three reusable patterns:

| Pattern | What the designer controls | Examples | What the library owns |
|---|---|---|---|
| **Content region** | The text, layouts and linked components inside a named region | Flyout body, Surface content, dialog body, card content | Shell, padding, border, shadow, shared layout and fixed controls |
| **Repeated linked items** | Add, remove, duplicate and reorder compatible item instances | Segments, menu options, list rows, accordion sections | Item styling and the group's layout; document selection and ordering rules |
| **Structured composition** | Edit repeated parts with relationships between them | Table rows/columns, tree hierarchy, grid cells, tab/panel pairs | Rules such as column widths, indentation, track sizing and matching active items |

Use native Figma slots for these editable regions. Use text properties for labels, instance swaps for one replaceable icon/component, booleans for optional fixed parts, and variants for appearance or state. Item count belongs to the instance's content; avoid a separate variant for every segment, row or menu-item count.

Slots provide the editable boundary. They do not enforce every relationship between children. Add a small helper or documented editing procedure where several parts must change together—for example, adding a table column to every row. Everyday content editing should work through Figma; designers should not need to run the library generator to change their screen.

For Box/Flex/Grid-style layouts, use a normal auto-layout frame with library variables when a reusable component shell provides no additional value. If we expose these as linked library components, their child content must be editable.

## Families requiring editable composition

“Required” below describes the intended designer capability. “Generator implemented” means the repository contains the composition; it does not establish publication or successful use in a consuming Figma file.

| Component family | Required editable regions | What designers must be able to do | Shared rules / fixed parts | Current implementation evidence |
|---|---|---|---|---|
| **SegmentedControl** | Repeated **Segments** containing linked **Item** instances | Change a two-segment control into five segments; rename, reorder and remove items; swap icons | Exactly one selected item for the standard control; consistent disabled/icon-only mode; group sizing. Current generator supports 2–10 items | Installed; native slot/default checks pass. Published-consumer acceptance tracked in the [checklist](slot-implementation-checklist.md) |
| **Flyout**, including **Surface** | Generic Surface **Content**; structured flyout **Body** and **Actions** | Insert a form, search results, list, explanatory content or another component; change footer buttons | Shadow, radius, padding, fixed dismissal controls and placement conventions | Installed; native slot/default checks pass. Published-consumer acceptance tracked in the [checklist](slot-implementation-checklist.md) |
| **Dialog** | **Body** and **Actions**; optional **Side content** for that source layout | Build a confirmation dialog, a larger form or a dialog with supporting content; vary actions | Dialog shell, sizing conventions, header/close anatomy, body scrolling and action alignment | Installed; native slot/default checks pass. Published-consumer acceptance tracked in the [checklist](slot-implementation-checklist.md) |
| **Card** | **Content**, **Actions** and optional custom **Banner content** | Combine content and linked components; vary action count; replace supported media | Card framing, padding and defined title/media/action roles. Use properties or swaps for simple titles, images and icons | Installed; native slot/default checks pass. Published-consumer acceptance tracked in the [checklist](slot-implementation-checklist.md) |
| **Accordion** | Repeated **Items**; each item's expanded **Content** | Add sections, reorder them and place their own content inside each expanded section | Linked trigger/header anatomy, chevron, borders, spacing and expanded-state conventions | Installed; native slot/default checks pass. Published-consumer acceptance tracked in the [checklist](slot-implementation-checklist.md) |
| **Dropdown** | Repeated **Items**, **Groups** and nested **Submenu items** | Build menus of different lengths with headings, separators and submenus | Linked item types; labels, icons and shortcuts use their own properties; submenu ownership stays explicit | Installed; native slot/default checks pass. Published-consumer acceptance tracked in the [checklist](slot-implementation-checklist.md) |
| **Select** | **Options / Groups**; selected-value composition for multiple-select designs | Add/remove/reorder options; create groups; show realistic selected values and badges | Trigger anatomy and value presentation; selected options and visible badges must agree | Installed; native slot/default checks pass. Published-consumer acceptance tracked in the [checklist](slot-implementation-checklist.md) |
| **RadioList** | Repeated linked **Options** | Build a list with the required number of options and edit labels/descriptions | One selected option for single choice; group spacing and radio alignment | Installed; native slot/default checks pass. Published-consumer acceptance tracked in the [checklist](slot-implementation-checklist.md) |
| **OrderableList** | Repeated **Items**; structured item **Content / Actions** where needed | Add and reorder rows; compose row content and supported actions | Drag-handle placement, row spacing, dividers and interaction states | Installed; native slot/default checks pass. Published-consumer acceptance tracked in the [checklist](slot-implementation-checklist.md) |
| **Table** | **Rows**, row **Cells**, and editable **Cell content**; include custom **Header content** where needed | Add rows and complete columns; put text, status indicators, buttons or other linked components in cells; design richer headers | Equal column counts, aligned widths, matching header/body columns and row styling. Column edits must update every row | Installed; native slot/default checks pass. Published-consumer acceptance tracked in the [checklist](slot-implementation-checklist.md) |
| **Tabs** | Repeated **Triggers** and associated **Panel content** | Add tabs, reorder them and create the content associated with each tab | Trigger/panel pairing, one active tab and shared trigger styling | Installed; native slot/default checks pass. Published-consumer acceptance tracked in the [checklist](slot-implementation-checklist.md) |
| **Tree** | Repeated **Nodes**, nested **Children**, and supported node **Content / Actions** | Add nodes at different levels; reorder siblings; create expanded/collapsed examples | Parent/child relationships, indentation, disclosure controls and selection conventions | Installed; native slot/default checks pass. Published-consumer acceptance tracked in the [checklist](slot-implementation-checklist.md) |
| **Notice** | **Message content** and **Action** region | Use multiline/rich message content and an appropriate action component | Status styling, leading icon role, dismiss control and spacing | Installed; native slot/default checks pass. Published-consumer acceptance tracked in the [checklist](slot-implementation-checklist.md) |
| **Tooltip** | Formatted, noninteractive **Content** | Replace helper text and compose supported rich explanatory content | Tooltip shell, spacing and trigger relationship; interactive forms/actions belong in a flyout-style pattern | Installed; native slot/default checks pass. Published-consumer acceptance tracked in the [checklist](slot-implementation-checklist.md) |
| **Section** | **Content** | Put different page/form content inside the shared section | Shared section framing, spacing and any defined heading role | Installed; native slot/default checks pass. Published-consumer acceptance tracked in the [checklist](slot-implementation-checklist.md) |
| **ScrollArea** | **Content** | Place a realistic list, form or other design inside a bounded scrolling region | Viewport, clipping/overflow conventions and scrollbar presentation | Installed; native slot/default checks pass. Published-consumer acceptance tracked in the [checklist](slot-implementation-checklist.md) |
| **Box** | **Children**, if offered as a linked container | Populate a styled container with arbitrary design content | Background, border, radius and padding | Installed; native slot/default checks pass. Published-consumer acceptance tracked in the [checklist](slot-implementation-checklist.md) |
| **Flex** | Repeated **Children**, if offered as a linked container | Add, remove and reorder content in a shared horizontal/vertical layout | Direction, gap, wrapping and alignment | Installed; native slot/default checks pass. Published-consumer acceptance tracked in the [checklist](slot-implementation-checklist.md) |
| **Grid** | Repeated **Cells**, if offered as a linked container | Populate a grid with varying numbers of cards or other components | Columns/tracks, gaps, cell spans and resizing rules | Installed; native slot/default checks pass. Published-consumer acceptance tracked in the [checklist](slot-implementation-checklist.md) |
| **Toolbar (rte)** | Repeated **Action groups / Actions** | Add/reorder supported formatting controls and dropdowns | Group spacing, separators, button states and toolbar layout; actual editor behavior stays in code | Installed; native slot/default checks pass. Published-consumer acceptance tracked in the [checklist](slot-implementation-checklist.md) |
| **FloatingModalWrapper (rte)** | **Content** | Place the appropriate editor form or linked controls inside the floating shell | Shell styling, padding, positioning conventions and fixed controls | Installed; native slot/default checks pass. Published-consumer acceptance tracked in the [checklist](slot-implementation-checklist.md) |

### Important compound-component details

**Surface and structured flyouts:** provide a generic Surface with one flexible Content slot, plus a structured flyout composition with named Body/Actions regions when those shared roles are useful. A generic Surface can already contain a designer's own layout. We do not need a slot on every wrapper layer to achieve that flexibility.

**Lists:** distinguish the collection from the row. The collection needs repeatable linked items; a richer row may also need a bounded content/action region. There is no standalone `List` family in this pinned inventory. A plain content list can be an auto-layout composition of linked rows; a new public List component would be a separate library decision.

**Tables:** body ContentCell support does not complete every table use case. The generator now includes a ContentHeaderCell for source header cells containing labels or custom controls. Captions can normally use an editable text property. Column spans, sticky columns and more complex sizing need explicit designs and rules before they are promised.

**Tabs and trees:** a collection slot alone is insufficient. Define the relationship between each tab and panel, and between each tree node and its children. Shared helpers should make these relationships easy to preserve.

## Chart helpers requiring a decision

The existing generated policy report marks these as data-driven with no slot planned. This review makes their designer-editing needs explicit; the recommendations below are not implemented policy changes.

| Component family | Designer need | Recommended approach | Slot decision |
|---|---|---|---|
| **Legend (charts)** | Add/remove/reorder legend entries and edit their labels and markers | Prefer entries driven by the same series data as the chart. For manually composed specimens, use repeatable linked LegendItem instances | **Conditional repeated-items slot** if manual legend composition is part of the Figma offering |
| **Tooltip (charts)** | Show different series names, values and numbers of rows | Drive rows from chart/sample data. If offered as an independently editable specimen, allow linked value rows | **Conditional repeated-rows slot**; do not imply that the tooltip is an arbitrary application-content container |
| **ChartHeading (charts)** | Change title, description and icon; optionally supply a richer title component | Text properties and an icon swap cover the normal case. Source permits richer title content | **Conditional content slot** for confirmed rich-title use cases; properties are sufficient for ordinary headings |

## Families that do not need unrestricted content slots by default

These still need usable designer controls. A “no slot” decision does not mean a frozen screenshot, a fixed label or an uneditable icon.

### Controls, text and indicators

| Component family | How designers should customize it | Why a general content slot is unnecessary |
|---|---|---|
| **AssetInput** | Change preview media, placeholder text, size and supported input states | Defined asset-input anatomy; media/preview customization should use the relevant property or nested part |
| **Badge** | Edit text, icon and appearance/state properties | Compact, defined content roles |
| **Button** | Edit label, swap supported icons, set size/emphasis/state | Preserve the button's defined anatomy and spacing |
| **Checkbox** | Set checked/unchecked/mixed/disabled state and supported label properties | Additional form content belongs in a surrounding field/list composition |
| **ColorPicker** | Set selected color, supported value rows and picker state | Picker internals represent color data and defined controls |
| **DatePicker** | Set the shown date/range, month and supported states | Calendar days and selection should follow date data rather than arbitrary child insertion |
| **Divider** | Change orientation, style and size | No child-content region |
| **EditableText** | Edit text and display/editing state | The editable value is the content |
| **Heading** | Edit text, level/size and color | Typography properties cover the ordinary heading role |
| **Label** | Edit label text and emphasis | Defined text role |
| **Link** | Edit text, supported icon and visual state | Defined inline control; richer linked content needs a deliberate separate composition |
| **LoadingBar** | Set progress and supported visual states | Data/state-driven indicator |
| **LoadingCircle** | Set progress/result state and size | Data/state-driven indicator |
| **Slider** | Set value/range and supported states | Thumb/track positions follow values; arbitrary children would obscure the control model |
| **SplitButton** | Edit primary action, icons and state; compose its menu using Dropdown | Fixed two-action anatomy; variable menu items belong to the menu composition |
| **Switch** | Set on/off/disabled state and supported label properties | Fixed control anatomy |
| **Tag** | Edit text, icon, dismissibility and appearance | Defined compact content roles |
| **Text** | Edit styled text and typography properties | Native text editing provides the flexibility |
| **Textarea** | Edit value, placeholder and input state | Defined input content and anatomy |
| **TextInput** | Edit value/placeholder, swap supported icons and set input state | Use dedicated adornment properties; add a named region only for a supported adornment that a swap cannot express |

### Chart bodies

| Component family | How designers should customize it | Slot decision |
|---|---|---|
| **AreaStackChart (charts)** | Edit series, values, labels and visible chart options | Use editable chart/sample data; general slots are unsuitable for data marks |
| **BarChart (charts)** | Edit categories/series, values and labels | Use editable chart/sample data; general slots are unsuitable for bars |
| **LineChart (charts)** | Edit series, values and labels | Use editable chart/sample data; general slots are unsuitable for points and lines |
| **LinearGauge (charts)** | Edit value, range and supported labels | Use value/configuration controls |
| **PieChart (charts)** | Edit categories, values and labels | Use editable chart/sample data; general slots are unsuitable for sectors |
| **Treemap (charts)** | Edit hierarchy, values and labels | Use editable chart/sample data; general slots are unsuitable for generated tiles |

An editable chart-data workflow is a separate requirement; these rows do not claim that such an editor already exists. Composition around charts—headings, legends and other accessories—should remain editable through the appropriate linked parts.

### Editor primitives and runtime providers

| Component family | How it should be used in designs | Slot decision |
|---|---|---|
| **RichTextEditor (rte)** | Editable formatted document examples plus the composable toolbar above | Use text/document editing for the main value. A general slot is not the editor's document model; embedded custom blocks need a separate reviewed contract |
| **ToolbarButton (rte)** | Swap the supported icon/content and set pressed/disabled/dropdown appearance | Keep the individual button's anatomy; variable button counts belong to Toolbar |
| **RouterProvider** | Runtime navigation context | No visible canvas region to populate |
| **ThemeProvider** | Runtime/theme context; represent design themes through the library's supported modes | No visible content-slot component is required solely to model the provider |

## Suggested delivery order

1. **Prove the core workflows:** Surface/Flyout, SegmentedControl, Table and Dialog. These cover flexible content, repeated items and coordinated structures. Finish native and consuming-file checks for the existing implementations.
2. **Make common collections usable:** Dropdown, Select, RadioList, OrderableList, Tabs and Accordion. Reuse linked item parts and the same add/remove/reorder conventions.
3. **Complete content containers:** Card, Notice, Tooltip, Section and ScrollArea. Decide whether Box/Flex/Grid belong as linked components or native token-bound layouts.
4. **Handle specialized structures:** Tree, richer table headers, rich-text toolbar/modal composition and the chart-helper decisions above.

This ordering now also guides native verification. It is not a claim about usage frequency or an approved publication roadmap.

## Designer acceptance criteria

A family is ready for designers when the relevant workflow passes in an ordinary consuming design file:

- A designer can add, remove and reorder allowed content without detaching the surrounding instance.
- Repeated items remain linked components, with their own labels, icons and state controls accessible.
- Auto-layout responds to item count, text length and resizing. Shared rules such as table alignment or single selection have a clear editing workflow.
- Accepting a library update preserves customized slot content, its order and nested instance links. Variant changes have a documented, verified preservation behavior.
- The default example explains where to insert content; empty, short and longer content all produce usable layouts. Source limits are stated where relevant.
- The workflow works with the published library. Any optional helper works in consuming files, and a documented native editing path exists for the supported content operations.

Figma composition describes the design. Keyboard behavior, focus handling, data fetching and runtime interactions remain the corresponding code component's responsibility.

## Implementation state and maintenance

The generator now implements the required slots for all 21 families, with linked defaults and explicit actions for the structured cases. Local tests cover insertion of every family, preservation of existing content and rejection of uneven structures. The [implementation checklist](slot-implementation-checklist.md) records native and published-consumer verification independently. The existing Surface evidence remains valid for its recorded scope; new native checks must establish the expanded scope.

Keep this file as the designer-facing requirements and decisions. Maintain the machine-readable family policies in [`recipes/composition-policies.json`](../recipes/composition-policies.json), and use the generated [`composition-overview.md`](composition-overview.md) to find new, missing or partially implemented definitions. “Available” in that generated report means its configured slot recipes exist; it does not certify that every workflow in this requirements document is complete.

When adding or updating components:

1. Rebuild the inventory against the reviewed source release. New source families appear as **Needs review** in the generated overview; planned/removed policy entries remain **Not in source**.
2. Review the designer task and classify the family as content, repeated items, structured composition, properties or data. Add/update its row here and the corresponding policy entry.
3. Specify editable regions, compatible linked parts, shared rules and migration behavior. Record conditional decisions explicitly rather than assuming every `children` prop needs an unrestricted slot.
4. Implement and verify in a consuming file, then update the evidence. Slot-region presence and designer readiness should be tracked separately.

For example, a future inventory UI can show **Composition required**, **Regions implemented**, **Native verified** and **Published/consumer verified** as separate fields. That would make the table useful for decisions without treating a generated recipe as a finished designer workflow.

Source and supporting material: [pinned bundle and inventory](../bundles/fondue-13.11.1.json), [family policies](../recipes/composition-policies.json), [slot implementation/workflows](content-slots.md), [current implementation evidence](evidence/composition-slots-2026-11-06.json), and [Surface evidence](evidence/surface-slots-2026-11-02.json).
