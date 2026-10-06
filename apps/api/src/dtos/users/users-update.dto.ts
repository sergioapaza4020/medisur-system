import { OmitType, PartialType } from '@nestjs/swagger';
import { UserCreateDto } from './users.dto';

export class UserUpdateDto extends PartialType(OmitType(UserCreateDto, ['roleNames'] as const), {
  skipNullProperties: false,
}) {}
