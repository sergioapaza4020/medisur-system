import { IsDateString, IsEnum, IsIn, IsOptional, Matches } from 'class-validator';
import { PaginationQueryDto } from '../common/pagination-query.dto';
import { AppointmentStatus } from 'src/entities/appointments/appointment.entity';

export class AppointmentsQueryDto extends PaginationQueryDto {
  @IsIn(['upcoming', 'past', 'all'])
  period: 'upcoming' | 'past' | 'all' = 'upcoming';

  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @IsOptional()
  @Matches(/^(?!0000)\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  date?: string;
}
