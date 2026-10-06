import { ApiProperty } from '@nestjs/swagger';
import { IsArray } from 'class-validator';

export class RolesAssignPermissionsDto {
  @ApiProperty()
  @IsArray()
  permissionNames: string[];
}
