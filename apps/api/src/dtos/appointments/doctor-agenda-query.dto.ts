import { PickType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { AvailabilityQueryDto } from '../schedules/availability-query.dto';
import { AppointmentStatus } from 'src/entities/appointments/appointment.entity';

// Reuse the existing strict date/range validators and common pagination fields.
export class DoctorAgendaQueryDto extends PickType(AvailabilityQueryDto, [
  'date',
  'from',
  'to',
  'page',
  'limit',
] as const) {
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;
}
