import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Matches, Min } from 'class-validator';
import { PaginationQueryDto } from '../common/pagination-query.dto';

export class AvailabilityQueryDto extends PaginationQueryDto {
  @Matches(/^(?!0000)\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe tener un a\u00f1o entre 0001 y 9999',
  })
  @IsDateString({ strict: true }, { message: 'La fecha debe ser v\u00e1lida' })
  date: string;

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
