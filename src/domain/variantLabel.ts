export function formatVariantLabel(
  v1: string | null,
  v2: string | null,
): string | null {
  if (v1 && v2) return `${v1} / ${v2}`;
  return v1 ?? v2 ?? null;
}
