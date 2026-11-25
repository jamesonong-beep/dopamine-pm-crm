export const recordSortOptions = [
  { value: 'name', label: 'A–Z' },
  { value: 'name-desc', label: 'Z–A' },
  { value: 'newest', label: 'Newest added' },
  { value: 'oldest', label: 'Oldest added' }
] as const;

export type RecordSort = (typeof recordSortOptions)[number]['value'];

const collator = new Intl.Collator('en-PH', { sensitivity: 'base', numeric: true });

export function compareRecordNames(a: string, b: string) {
  return collator.compare(a.trim(), b.trim());
}

export function compareRecordDates(a: string | undefined, b: string | undefined, newest: boolean) {
  const dateA = a ? Date.parse(a) : NaN;
  const dateB = b ? Date.parse(b) : NaN;
  if (!Number.isFinite(dateA)) return Number.isFinite(dateB) ? 1 : 0;
  if (!Number.isFinite(dateB)) return -1;
  return newest ? dateB - dateA : dateA - dateB;
}

export function compareRecords<T extends { createdAt?: string }>(
  a: T, b: T, sort: RecordSort, label: (item: T) => string
) {
  const byName = compareRecordNames(label(a), label(b));
  if (sort === 'name-desc') return -byName;
  if (sort === 'name') return byName;
  return compareRecordDates(a.createdAt, b.createdAt, sort === 'newest') || byName;
}

export function orderRecords<T extends { createdAt?: string }>(
  rows: readonly T[], sort: RecordSort, label: (item: T) => string,
  first?: (item: T) => boolean
) {
  return [...rows].sort((a, b) =>
    (first ? Number(first(b)) - Number(first(a)) : 0) ||
    compareRecords(a, b, sort, label)
  );
}
