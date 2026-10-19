// Calendar arithmetic only. Eligibility and intervals always come from the API.
export function boliviaToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((value) => value.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function monthDates(month: string) {
  const first = new Date(`${month}-01T12:00:00Z`);
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12));
  return {
    from: `${month}-01`,
    to: `${month}-${last.getUTCDate()}`,
    offset: (first.getUTCDay() + 6) % 7,
    days: last.getUTCDate(),
  };
}

export function moveMonth(month: string, delta: number) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function displayDate(date: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('es-BO', { ...options, timeZone: 'America/La_Paz' }).format(
    new Date(`${date}T12:00:00Z`),
  );
}
