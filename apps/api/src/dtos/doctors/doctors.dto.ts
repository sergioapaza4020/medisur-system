import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  Min,
  ValidateIf,
} from 'class-validator';
import { UsersQueryDto } from '../users/users-query.dto';

export class DoctorCreateDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  idUser: number;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  isActive: boolean = true;

  @ApiPropertyOptional({ type: [Number], default: [] })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  @Min(1, { each: true })
  specialtyIds: number[] = [];
}

export class DoctorsQueryDto extends UsersQueryDto {}

export class DoctorSpecialtiesDto {
  @ApiProperty({ type: [Number], description: 'Asignaciones actuales; [] retira todas.' })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  @Min(1, { each: true })
  specialtyIds: number[];
}
