import { PartialType } from '@nestjs/swagger';
import { PermissionCreateDto } from './permissions.dto';

export class PermissionUpdateDto extends PartialType(PermissionCreateDto, {
  skipNullProperties: false,
}) {}
