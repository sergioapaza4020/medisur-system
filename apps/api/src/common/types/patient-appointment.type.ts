import { AppointmentStatus } from 'src/entities/appointments/appointment.entity';

export interface PatientAppointment {
  idAppointment: number;
  doctor: { name: string; lastname: string };
  specialty: { name: string };
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  cancellationReason: string | null;
  timeZone: 'America/La_Paz';
}
