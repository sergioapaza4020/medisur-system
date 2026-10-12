import { ApiProperty, ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { formatSpecialtyName } from 'src/common/utils/specialty-name';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../common/pagination-query.dto';
import { StatusQueryDto } from '../common/status-query.dto';

export class SpecialtyWriteDto {
  @ApiProperty({ maxLength: 100 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? formatSpecialtyName(value) : value,
  )
  @IsString()
  @Matches(/\S/, { message: 'El nombre es obligatorio' })
  @MaxLength(100)
  name: string;
}

export class SpecialtiesQueryDto extends IntersectionType(PaginationQueryDto, StatusQueryDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
