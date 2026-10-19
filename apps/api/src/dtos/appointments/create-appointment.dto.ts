import { IsInt, Min } from 'class-validator';

export class CreateAppointmentDto {
  @IsInt({ message: 'Selecciona un horario válido' })
  @Min(1)
  idSchedule: number;

  @IsInt()
  @Min(1)
  expectedVersion: number;
}
