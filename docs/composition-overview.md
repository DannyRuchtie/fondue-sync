# Component composition overview

Generated from the pinned source inventory, authored recipes and `recipes/composition-policies.json`. Rebuild to discover new source families. Recommendations are not approval or live Figma verification.

| Component | Approach | Candidate regions | Generator status |
|---|---|---|---|
| charts / AreaStackChart | data-driven | — | No slot planned |
| charts / BarChart | data-driven | — | No slot planned |
| charts / ChartHeading | data-driven | — | No slot planned |
| charts / Legend | data-driven | — | No slot planned |
| charts / LinearGauge | data-driven | — | No slot planned |
| charts / LineChart | data-driven | — | No slot planned |
| charts / PieChart | data-driven | — | No slot planned |
| charts / Tooltip | data-driven | — | No slot planned |
| charts / Treemap | data-driven | — | No slot planned |
| components / Accordion | repeated | Items, Item content | Available |
| components / AssetInput | fixed | — | No slot planned |
| components / Badge | fixed | — | No slot planned |
| components / Box | layout | Children | Available |
| components / Button | fixed | — | No slot planned |
| components / Card | content | Body, Footer, Banner content | Available |
| components / Checkbox | fixed | — | No slot planned |
| components / ColorPicker | fixed | — | No slot planned |
| components / DatePicker | fixed | — | No slot planned |
| components / Dialog | content | Body, Footer actions | Available |
| components / Divider | fixed | — | No slot planned |
| components / Dropdown | repeated | Items, Groups | Available |
| components / EditableText | fixed | — | No slot planned |
| components / Flex | layout | Children | Available |
| components / Flyout | content | Surface content, Body, Footer actions | Available |
| components / Grid | structured | Cells | Available |
| components / Heading | fixed | — | No slot planned |
| components / Label | fixed | — | No slot planned |
| components / Link | fixed | — | No slot planned |
| components / LoadingBar | fixed | — | No slot planned |
| components / LoadingCircle | fixed | — | No slot planned |
| components / Notice | content | Body, Actions | Available |
| components / OrderableList | repeated | Items | Available |
| components / RadioList | repeated | Options | Available |
| components / RouterProvider | code-only | — | No slot planned |
| components / ScrollArea | layout | Children | Available |
| components / Section | layout | Children | Available |
| components / SegmentedControl | repeated | Segments | Available |
| components / Select | repeated | Items, Groups | Available |
| components / Slider | fixed | — | No slot planned |
| components / SplitButton | fixed | — | No slot planned |
| components / Switch | fixed | — | No slot planned |
| components / Table | structured | Rows, Cells, Cell content | Available |
| components / Tabs | repeated | Triggers, Panel content | Available |
| components / Tag | fixed | — | No slot planned |
| components / Text | fixed | — | No slot planned |
| components / Textarea | fixed | — | No slot planned |
| components / TextInput | fixed | — | No slot planned |
| components / ThemeProvider | code-only | — | No slot planned |
| components / Tooltip | content | Content | Available |
| components / Tree | structured | Rows, Nested children | Available |
| rte / FloatingModalWrapper | content | Content | Available |
| rte / RichTextEditor | data-driven | — | No slot planned |
| rte / Toolbar | content | Actions | Available |
| rte / ToolbarButton | data-driven | — | No slot planned |

21 of 21 required composition families have their configured slot contracts in every supported state. “Available” describes generator coverage; native verification and published-consumer acceptance are separate. Use Sync → Compose with slots to insert an editable family. Table, radio, tab, tree and grid actions assist with coordinated edits. Existing sample components retain their identities. See [designer requirements](designer-composition-requirements.md) and the [implementation checklist](slot-implementation-checklist.md).
