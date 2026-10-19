import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Matches, Min, ValidateIf } from 'class-validator';
import { PaginationQueryDto } from '../common/pagination-query.dto';

export class AvailabilityQueryDto extends PaginationQueryDto {
  @ValidateIf(
    (query: AvailabilityQueryDto) =>
      query.date !== undefined || (query.from === undefined && query.to === undefined),
  )
  @Matches(/^(?!0000)\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe tener un a\u00f1o entre 0001 y 9999',
  })
  @IsDateString({ strict: true }, { message: 'La fecha debe ser v\u00e1lida' })
  date?: string;

  @ValidateIf((query: AvailabilityQueryDto) => query.from !== undefined || query.to !== undefined)
  @Matches(/^(?!0000)\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  from?: string;

  @ValidateIf((query: AvailabilityQueryDto) => query.from !== undefined || query.to !== undefined)
  @Matches(/^(?!0000)\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  to?: string;

  @Type(() => Number)
  @IsInt({ message: 'Selecciona un médico válido' })
  @Min(1)
  idDoctor: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Selecciona una especialidad válida' })
  @Min(1)
  idSpecialty?: number;
}
