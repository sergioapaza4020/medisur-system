// Each published block is reserved as a whole.
export interface AvailabilityBlock {
  idSchedule: number;
  version: number;
  idDoctor: number;
  idSpecialty: number;
  date: string;
  startTime: string;
  endTime: string;
  timeZone: 'America/La_Paz';
}
