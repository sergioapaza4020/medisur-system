import { ApiProperty } from '@nestjs/swagger';
import { IsArray } from 'class-validator';

export class UsersAssignRolesDto {
  @ApiProperty()
  @IsArray()
  roleNames: string[];
}
