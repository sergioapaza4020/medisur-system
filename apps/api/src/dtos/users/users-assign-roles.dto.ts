import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsNotEmpty, IsArray, IsString, Matches } from 'class-validator';

export class UsersAssignRolesDto {
  @ApiProperty()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @Matches(/\S/, { each: true })
  roleNames: string[];
}
