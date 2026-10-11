import { Transform } from 'class-transformer';
import { transformEmail } from 'src/common/utils/normalize-email';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MaxLength, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'usuario@correo.com', description: 'Correo electrónico' })
  @Transform(transformEmail)
  @IsEmail()
  @MaxLength(254)
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password', description: 'Password' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
