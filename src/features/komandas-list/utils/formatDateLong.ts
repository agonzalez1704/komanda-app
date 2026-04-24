export function formatDateLong(d: Date): string {
  try {
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  } catch {
    return d.toDateString();
  }
}
