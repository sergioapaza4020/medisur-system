import { Transform } from 'class-transformer';
import { IsInt, IsString, Length, Min, ValidateIf } from 'class-validator';

export class CreateEncounterDto {
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsInt()
  @Min(1)
  idAppointment?: number;

  @ValidateIf(
    (dto: CreateEncounterDto, value: unknown) =>
      dto.idAppointment === undefined || value !== undefined,
  )
  @IsInt()
  @Min(1)
  idPatient?: number;

  @ValidateIf(
    (dto: CreateEncounterDto, value: unknown) =>
      dto.idAppointment === undefined || value !== undefined,
  )
  @IsInt()
  @Min(1)
  idSpecialty?: number;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 10000, { message: 'El resumen de atención debe tener entre 1 y 10000 caracteres' })
  summary: string;
}
