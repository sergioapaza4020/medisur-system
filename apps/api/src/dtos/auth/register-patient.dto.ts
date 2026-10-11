import { transformEmail } from 'src/common/utils/normalize-email';
import { ApiProperty, OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsByteLength, IsEmail, IsStrongPassword, Matches, MaxLength } from 'class-validator';
import { UserCreateDto } from '../users/users.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class RegisterPatientDto extends OmitType(UserCreateDto, ['roleNames'] as const) {
  @Transform(transformEmail)
  @IsEmail({}, { message: 'Ingresa un correo electrónico válido' })
  @MaxLength(254, { message: 'El correo electrónico no debe superar 254 caracteres' })
  email: string;

  @Transform(trim)
  @Matches(/^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u, { message: 'Ingresa nombres válidos' })
  @MaxLength(100, { message: 'Los nombres no deben superar 100 caracteres' })
  name: string;

  @Transform(trim)
  @Matches(/^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u, {
    message: 'Ingresa apellidos válidos',
  })
  @MaxLength(100, { message: 'Los apellidos no deben superar 100 caracteres' })
  lastname: string;

  @Transform(trim)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9 .-]{2,29}$/, {
    message: 'Ingresa un documento válido de entre 3 y 30 caracteres',
  })
  ci: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsStrongPassword(
    { minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 0 },
    {
      message:
        'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número',
    },
  )
  @IsByteLength(0, 72, { message: 'La contraseña es demasiado larga. Usa menos caracteres.' })
  password: string;
}
