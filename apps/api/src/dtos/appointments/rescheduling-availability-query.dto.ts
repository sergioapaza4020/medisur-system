import { OmitType } from '@nestjs/swagger';
import { AvailabilityQueryDto } from '../schedules/availability-query.dto';

// Keep shared date/range validation and pagination; identity is resolved from the appointment.
export class ReschedulingAvailabilityQueryDto extends OmitType(AvailabilityQueryDto, [
  'idDoctor',
  'idSpecialty',
] as const) {}
