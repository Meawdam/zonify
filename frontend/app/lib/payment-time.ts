// datetime-local always denotes Thai civil time (UTC+07:00), never device time.
export function thaiTransferISO(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match || Number(match[1]) < 1) return null;
  const normalized = value.length === 16 ? value + ":00" : value;
  const local = new Date(normalized + "Z");
  if (!Number.isFinite(local.valueOf()) || local.toISOString().slice(0, 19) !== normalized) return null;
  return new Date(local.valueOf() - 7 * 60 * 60_000).toISOString();
}
