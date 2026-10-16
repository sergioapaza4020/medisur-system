import { PartialType, PickType } from '@nestjs/swagger';
import { IsByteLength, IsEmpty, IsNotEmpty, IsString } from 'class-validator';
import { RegisterPatientDto } from '../auth/register-patient.dto';

export class UpdateMyAccountDto extends PartialType(
  PickType(RegisterPatientDto, ['name', 'lastname', 'email', 'ci'] as const),
  { skipNullProperties: false },
) {
  @IsEmpty() idUser?: never;
  @IsEmpty() roles?: never;
  @IsEmpty() roleNames?: never;
  @IsEmpty() permissions?: never;
  @IsEmpty() isActive?: never;
}

export class ChangeMyPasswordDto extends PickType(RegisterPatientDto, ['password'] as const) {
  @IsString()
  @IsNotEmpty()
  @IsByteLength(1, 72)
  currentPassword: string;
}
