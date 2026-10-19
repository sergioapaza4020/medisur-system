import { IsInt, Min } from 'class-validator';
import { CreateAppointmentDto } from './create-appointment.dto';

export class CreateAdministrativeAppointmentDto extends CreateAppointmentDto {
  @IsInt({ message: 'Selecciona un paciente válido' })
  @Min(1)
  idPatient: number;
}
