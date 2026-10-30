# Fondue Sync

Bring Fondue components, colors, spacing and styles into Figma—and propose improvements back to Fondue.

The plugin has two tabs: **Sync** to create or update the library, and **Push changes** to send selected edits for review.

**Just designing?** Enable the published Fondue library in your Figma file and use components from Assets. You only need the plugin if you maintain the library or want to propose changes.

[Open the library review file](https://www.figma.com/design/ZmOzqBnHNixUTV1TqRtBHs)

## Part 1: Set up the library

Ask a maintainer for the built plugin folder and the required ABC Diatype and Cranny fonts. You’ll need Figma desktop and permission to edit and publish the library.

1. Open a dedicated Figma library file. Use a test file for your first import.
2. Choose **Plugins → Development → Import plugin from manifest** and select `dist/manifest.json` from the plugin folder.
3. Run **Fondue Sync**, open **Sync**, and choose **Import Fondue**.
4. Run **Validate**, review any warnings, and check the components visually.
5. Publish the library through Figma so others can use it.

Keep component instances connected to receive future library updates.

## Part 2: Update the library and push PRs

### Get an updated library

Ask a maintainer for a plugin build containing the new Fondue release. Then:

1. Open the existing library file and choose **Sync → Compare**.
2. Review the changes and resolve any conflicts.
3. Choose **Update library**, then **Validate** and check the result visually.
4. Publish the library. Designers can then review and accept the update in their files.

### Propose a change to Fondue

A pull request (PR) is a proposed change that maintainers review before adding it to Fondue.

Ask a maintainer to set up the PR connection first. They’ll provide a pairing secret to enter under **Push changes → Connect PR service**.

1. Change a Fondue object—for example, a badge’s corner radius or a button’s spacing—and select it.
2. Open **Push changes** and choose **Review selected object**.
3. Choose the changes to include. Reuse an existing design token (a named color, size or spacing value), or name a new one.
4. Add a title and explain why the change helps.
5. Choose **Preview PR diff** to review the proposed changes. Ask a maintainer to help resolve any source-mapping questions or conflicts.
6. Confirm the shared impact and choose **Create draft PR**. Open the GitHub link to follow the review.

Only the selection and its required tokens are proposed. A shared component or token change can affect other designs too. New tokens are included in the same PR, and normal instance labels stay local.

After approval, merge and release, a maintainer brings the change back through **Sync** and publishes the updated Figma library.

The push workflow is a development feature. Some changes need additional mapping support. Maintainers must review accessibility, component behavior and visual checks before merging. Creating a PR does not publish the library.

## For maintainers and developers

- [Build and maintain the plugin](docs/maintainer-guide.md)
- [Set up the PR connection and token builds](docs/push-changes.md)
- [Verification checklist](docs/verification.md)
- [Known gaps](docs/gaps.md)

Fondue assets belong to their upstream authors. See the [illustration credits](docs/illustrations/README.md).
