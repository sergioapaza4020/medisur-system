import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class PermissionCreateDto {
  @ApiProperty()
  @IsString()
  @Matches(/\S/)
  name: string;

  @ApiProperty()
  @IsString()
  description: string;
}
