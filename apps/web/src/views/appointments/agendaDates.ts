import { displayDate, monthDates, moveMonth } from '@/views/schedules/availabilityDates';
import type { DoctorAppointment } from '@/types/doctor-agenda';

export type AgendaView = 'day' | 'week' | 'month';
export const viewLabels = { day: 'Día', week: 'Semana', month: 'Mes' };
const dateValue = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
export function addDays(value: string, delta: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return dateValue(date);
}
export function agendaPeriod(date: string, view: AgendaView) {
  if (view === 'month') return monthDates(date.slice(0, 7));
  const offset = view === 'week' ? (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7 : 0;
  const from = addDays(date, -offset);
  return { from, to: addDays(from, view === 'week' ? 6 : 0) };
}
export function navigateAgenda(date: string, view: AgendaView, delta: number) {
  if (view !== 'month') return addDays(date, delta * (view === 'week' ? 7 : 1));
  const month = moveMonth(date.slice(0, 7), delta);
  return `${month}-${String(Math.min(Number(date.slice(8)), monthDates(month).days)).padStart(2, '0')}`;
}
export function periodLabel(date: string, view: AgendaView) {
  if (view === 'month') return displayDate(date, { month: 'long', year: 'numeric' });
  if (view === 'day') return displayDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const { from, to } = agendaPeriod(date, view);
  return `${displayDate(from, { day: 'numeric', month: 'long', year: 'numeric' })} – ${displayDate(to, { day: 'numeric', month: 'long', year: 'numeric' })}`;
}
export function periodDays(from: string, to: string) {
  const days: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) days.push(date);
  return days;
}
export const timeMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
// Only simultaneous appointments share width; other events keep the full day column.
export function positionEvents(events: DoctorAppointment[]) {
  const result: { event: DoctorAppointment; lane: number; columns: number }[] = [];
  let group: typeof result = [];
  let lanes: number[] = [];
  let groupEnd = -1;
  const flush = () => {
    group.forEach((entry) => {
      entry.columns = lanes.length;
    });
    result.push(...group);
    group = [];
    lanes = [];
  };
  for (const event of [...events].sort((a, b) => a.startTime.localeCompare(b.startTime))) {
    const start = timeMinutes(event.startTime);
    const end = timeMinutes(event.endTime);
    if (start >= groupEnd) flush();
    let lane = lanes.findIndex((finish) => finish <= start);
    if (lane < 0) lane = lanes.length;
    lanes[lane] = end;
    group.push({ event, lane, columns: 1 });
    groupEnd = Math.max(start >= groupEnd ? -1 : groupEnd, end);
  }
  flush();
  return result;
}
export function boliviaClock() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/La_Paz',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());
}
