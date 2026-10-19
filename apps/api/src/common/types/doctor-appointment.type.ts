import { AppointmentStatus } from 'src/entities/appointments/appointment.entity';

export interface DoctorAppointment {
  idAppointment: number;
  patient: { name: string; lastname: string; ci: string };
  specialty: { name: string };
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  timeZone: 'America/La_Paz';
}
