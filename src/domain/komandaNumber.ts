export function formatYyyyMmDd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export interface KomandaIdentity {
  number: string | null;
  display_name: string | null;
  opened_at: string; // ISO
}

export function displayIdentifier(k: KomandaIdentity): string {
  if (k.number) return k.number;
  const dt = new Date(k.opened_at);
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  return k.display_name
    ? `Ticket — ${stamp} — ${k.display_name}`
    : `Ticket — ${stamp}`;
}
