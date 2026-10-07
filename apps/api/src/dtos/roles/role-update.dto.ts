import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayUnique, IsNotEmpty, IsArray, IsOptional, IsString, Matches } from 'class-validator';

export class RoleUpdateDto {
  @ApiProperty()
  @IsString()
  @Matches(/\S/)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @Matches(/\S/, { each: true })
  permissionNames: string[];
}
