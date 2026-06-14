export interface GroupedData<T> {
  key: string;
  label: string;
  items: T[];
  subGroups?: GroupedData<T>[];
}

/** Group an array of items by a field value */
export function groupBy<T>(
  items: T[],
  field: string,
  getLabel?: (key: string) => string,
): GroupedData<T>[] {
  if (field === "none") return [{ key: "all", label: "All", items }];

  const groups = new Map<string, T[]>();
  for (const item of items) {
    const val = String((item as Record<string, unknown>)[field] ?? "Unknown");
    if (!groups.has(val)) groups.set(val, []);
    groups.get(val)!.push(item);
  }

  return Array.from(groups.entries()).map(([key, groupItems]) => ({
    key,
    label: getLabel ? getLabel(key) : key,
    items: groupItems,
  }));
}

/** Group items with optional sub-grouping */
export function groupAndSubGroup<T>(
  items: T[],
  groupField: string,
  subGroupField: string,
  getLabel?: (key: string) => string,
): GroupedData<T>[] {
  const groups = groupBy(items, groupField, getLabel);
  if (subGroupField === "none") return groups;

  return groups.map((g) => ({
    ...g,
    subGroups: groupBy(g.items, subGroupField, getLabel),
  }));
}

/** Sort items by a field */
export function orderBy<T>(
  items: T[],
  field: string,
  direction: "asc" | "desc",
): T[] {
  if (field === "manual") return items;
  return items.toSorted((a, b) => {
    const aVal = (a as Record<string, unknown>)[field];
    const bVal = (b as Record<string, unknown>)[field];
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    const cmp =
      typeof aVal === "number" && typeof bVal === "number"
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal));
    return direction === "asc" ? cmp : -cmp;
  });
}
