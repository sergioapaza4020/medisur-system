import { IsBoolean, IsInt, Min } from 'class-validator';
import { CreateScheduleDto } from './create-schedule.dto';

// Full replacement: validate the same date, specialty and times as registration.
export class UpdateScheduleDto extends CreateScheduleDto {
  @IsBoolean({ message: 'El estado debe ser activo o inactivo' })
  isActive: boolean;

  @IsInt()
  @Min(1)
  expectedVersion: number;
}
