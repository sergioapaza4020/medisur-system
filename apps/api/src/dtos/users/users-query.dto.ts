import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { StatusQueryDto } from '../common/status-query.dto';
import { PaginationQueryDto } from '../common/pagination-query.dto';

export class UsersQueryDto extends IntersectionType(PaginationQueryDto, StatusQueryDto) {
  @ApiPropertyOptional({ description: 'Nombre, apellido, correo o documento' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
