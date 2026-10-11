import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { IsEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';
import { RoleCreateDto } from './roles.dto';

export class RoleAdministrativeCreateDto extends OmitType(RoleCreateDto, [
  'permissionNames',
] as const) {
  @IsEmpty({ message: 'La creación administrativa no permite asignar permisos' })
  permissionNames?: never;

  @IsEmpty({ message: 'El estado se modifica mediante activación/desactivación' })
  isActive?: never;
}

export class RoleAdministrativeUpdateDto {
  @ApiPropertyOptional()
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsEmpty({ message: 'El código interno del rol no puede modificarse' })
  name?: never;

  @IsEmpty({ message: 'La edición administrativa no permite modificar permisos' })
  permissionNames?: never;

  @IsEmpty({ message: 'El estado se modifica mediante activación/desactivación' })
  isActive?: never;
}
