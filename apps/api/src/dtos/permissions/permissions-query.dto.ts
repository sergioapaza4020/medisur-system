import { IntersectionType } from '@nestjs/swagger';
import { PaginationQueryDto } from '../common/pagination-query.dto';
import { StatusQueryDto } from '../common/status-query.dto';

export class PermissionsQueryDto extends IntersectionType(PaginationQueryDto, StatusQueryDto) {}
