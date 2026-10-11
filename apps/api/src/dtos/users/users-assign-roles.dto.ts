import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsNotEmpty, IsArray, IsString, Matches } from 'class-validator';

export class UsersAssignRolesDto {
  @ApiProperty()
  @IsArray()
  @ArrayMinSize(1, { message: 'El usuario debe tener al menos un rol' })
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @Matches(/\S/, { each: true })
  roleNames: string[];
}
