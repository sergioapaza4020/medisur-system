import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../common/pagination-query.dto';
import { RecordStatus, StatusQueryDto } from '../common/status-query.dto';

export class RolesQueryDto extends IntersectionType(PaginationQueryDto, StatusQueryDto) {
  @ApiPropertyOptional({ enum: RecordStatus, default: RecordStatus.ALL })
  status = RecordStatus.ALL;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
