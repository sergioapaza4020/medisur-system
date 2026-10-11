import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
} from 'class-validator';

export class UserCreateDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty()
  @IsString()
  @Matches(/\S/)
  username: string;

  @ApiProperty()
  @IsString()
  @Matches(/\S/)
  name: string;

  @ApiProperty()
  @IsString()
  @Matches(/\S/)
  lastname: string;

  @ApiProperty()
  @IsString()
  @Matches(/\S/)
  ci: string;

  @ApiProperty()
  @IsArray()
  @ArrayMinSize(1, { message: 'El usuario debe tener al menos un rol' })
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/\S/, { each: true })
  roleNames: string[];
}
