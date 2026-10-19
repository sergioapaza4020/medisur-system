import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../common/pagination-query.dto';

export class PatientSelectionQueryDto extends PaginationQueryDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3, { message: 'Ingresa al menos 3 caracteres para buscar pacientes' })
  @MaxLength(200)
  search: string;
}
