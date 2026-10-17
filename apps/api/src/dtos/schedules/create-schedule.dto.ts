import { IsDateString, IsInt, Matches, Min } from 'class-validator';

export class CreateScheduleDto {
  @IsInt({ message: 'Selecciona una especialidad válida' })
  @Min(1)
  idSpecialty: number;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha debe tener formato AAAA-MM-DD' })
  @IsDateString({ strict: true }, { message: 'La fecha debe ser válida' })
  date: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'La hora de inicio debe tener formato HH:mm' })
  startTime: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'La hora de fin debe tener formato HH:mm' })
  endTime: string;
}
