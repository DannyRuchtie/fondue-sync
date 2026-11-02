# Native content slots

## Designer workflow

Use **Overlays / Flyout / Surface** with **contentMode = slot**. Select the **Content** slot and insert, duplicate, remove or reorder layers and component instances. Edit nested components through their own properties. The surrounding Surface remains a linked library instance, including its shadow and corner-radius variants.

The initial text is default example content. It can be replaced in an instance. The source recipe's 16px padding remains the specimen's content spacing, not a newly introduced React prop.

Existing Surface variants retain their original main/child IDs and text property, exposed as **contentMode = sample**. Nine additive slot variants cover the same shadow/corner combinations. Changing from sample to slot is an explicit choice; copy any existing custom text before switching. An isolated Figma experiment lost its text override when an existing default was reparented into a slot, so the implementation deliberately avoids that automatic conversion.

`contentMode` is a Figma composition property, not a Fondue React prop. This first implementation enables Surface; segmented controls, dialogs and tables still need their own reviewed composition mappings.

## Repository contract

Recipes can declare `contentSlot` on a component-owned frame:

```js
contentSlot: {
  id: "content",
  name: "Content",
  description: "Add and arrange content here.",
}
```

Optional `minChildren` and `maxChildren` describe nonnegative layer-count guidance. These are Figma guidance, not strict runtime enforcement. Preferred-component lists and a registry editor are not implemented by this change.

The renderer creates a real native SlotNode inside the frame. Logical child IDs stay independent of that wrapper. Recipe children are the main component's default content. Text/icon properties below the boundary are not exposed through the outer component; nested components retain their own property APIs.

Sync renders library mains and their defaults. It never calls `resetSlot()` or rebuilds an instance's customized contents. Library main/default edits remain subject to ordinary drift protection; slot contents in a managed authored pattern are not silently exempted from conflict review. Ordinary consumer instances receive native Figma library updates.

Slot creation uses `ComponentNode.createSlot()`. Variant slots share one property on the owning component set. Slot removal, identity/name changes, and adding a slot around existing content require explicit migration. A failed first import can resume a tagged partial slot without replacing its identity.

## Verification on 2 November 2026

- Local engine tests cover shared properties across variants, default updates, preservation of customized instance contents, repeat inspection and interrupted-import recovery.
- The live review file received a targeted Surface migration using the shared slot helper, after saving **Before Surface content slots** in Version History and confirming the saved Surface baseline matched.
- The original nine mains remain; nine slot variants were added within the same managed set. The set's applied definition/snapshot was updated; the whole-file release fingerprint was not advanced.
- Repeating the targeted migration created and changed no nodes.
- Native tests preserved two custom text blocks across shadow/corner variant changes and preserved the main-component link of a Button placed inside a slot. Temporary test instances were removed.
- The existing Surface gallery instance uses slot mode. A screenshot confirmed its appearance remains intact.

These native checks do not substitute for a full Import/Update run with the rebuilt desktop plugin, published-library consumer acceptance, or version-history restoration testing. No library publication was performed.
