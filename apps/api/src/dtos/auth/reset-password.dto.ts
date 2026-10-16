import { IntersectionType, PickType } from '@nestjs/swagger';
import { IsByteLength, IsNotEmpty, IsString, Matches } from 'class-validator';
import { RegisterPatientDto } from './register-patient.dto';

export const INVALID_RECOVERY_TOKEN_MESSAGE =
  'El enlace de recuperación no es válido o ha expirado. Solicita uno nuevo.';

export class RecoveryTokenDto {
  @Matches(/^[a-f0-9]{64}$/, { message: INVALID_RECOVERY_TOKEN_MESSAGE })
  token: string;
}

export class ResetPasswordDto extends IntersectionType(
  RecoveryTokenDto,
  PickType(RegisterPatientDto, ['password'] as const),
) {
  @IsString({ message: 'Confirma tu nueva contraseña' })
  @IsNotEmpty({ message: 'Confirma tu nueva contraseña' })
  @IsByteLength(0, 72, { message: 'La contraseña es demasiado larga. Usa menos caracteres.' })
  confirmPassword: string;
}
