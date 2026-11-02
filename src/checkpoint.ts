export type Checkpoint = { id: string; title: string };
type HistoryAPI = {
  saveVersionHistoryAsync(
    title: string,
    description?: string,
  ): Promise<{ id: string } | null>;
};

/** Never invoke a mutating operation until Figma confirms a named version.
 * A checkpoint is a manual recovery point, not a transaction or guaranteed
 * capture of unsynced changes. Do not write document metadata before saving it.
 */
export async function withCheckpoint<T>(
  api: HistoryAPI,
  action: "import" | "update",
  release: string,
  operation: (checkpoint: Checkpoint) => Promise<T>,
  settle: () => Promise<void> = () =>
    new Promise((resolve) => setTimeout(resolve, 1000)),
): Promise<T> {
  const title = `Before Fondue ${action} · ${new Date().toISOString()}`;
  let saved: { id: string } | null;
  try {
    // Figma recommends allowing recent plugin edits time to reach history.
    // This reduces that timing risk; it cannot prove server-side completeness.
    await settle();
    saved = await api.saveVersionHistoryAsync(
      title,
      `Before ${action} of Fondue ${release}. To recover, restore this version in Figma Version History. Restoration affects the whole file.`,
    );
    if (!saved || typeof saved.id !== "string" || !saved.id.trim())
      throw Error("Figma did not return a saved version ID.");
  } catch {
    throw Error(
      "No changes made: Figma could not confirm a recovery version. Check the file is saved online and you have edit access, then try again.",
    );
  }
  return operation({ id: saved.id, title });
}
