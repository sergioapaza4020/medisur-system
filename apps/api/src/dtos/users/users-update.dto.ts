import { ApiHideProperty, OmitType, PartialType } from '@nestjs/swagger';
import { IsEmpty } from 'class-validator';
import { UserCreateDto } from './users.dto';

export class UserUpdateDto extends PartialType(
  OmitType(UserCreateDto, ['roleNames', 'password'] as const),
  {
    skipNullProperties: false,
  },
) {
  @ApiHideProperty()
  @IsEmpty({
    message:
      'Modifica los roles mediante la asignación de roles; el usuario debe tener al menos un rol',
  })
  roleNames?: never;
}
