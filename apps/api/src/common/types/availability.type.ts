// Intervals may be shortened or split by occupied appointments in EPIC-04.
export interface AvailabilityBlock {
  idSchedule: number;
  idDoctor: number;
  idSpecialty: number;
  date: string;
  startTime: string;
  endTime: string;
  timeZone: 'America/La_Paz';
}
