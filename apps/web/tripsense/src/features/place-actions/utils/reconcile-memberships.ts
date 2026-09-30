export async function reconcileMemberships(
  previousIds: Iterable<string>,
  selectedIds: Iterable<string>,
  add: (id: string) => Promise<void>,
  remove: (id: string) => Promise<void>,
): Promise<void> {
  const previous = new Set(previousIds);
  const selected = new Set(selectedIds);

  // Additions run first so a failed add never causes unrelated destructive removals.
  for (const id of selected) {
    if (!previous.has(id)) await add(id);
  }
  for (const id of previous) {
    if (!selected.has(id)) await remove(id);
  }
}
