import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsString, Length, Matches, Min } from 'class-validator';
import { ExtraordinaryGrantType } from 'src/entities/medical-records/extraordinary-grant.entity';

export class RevokeExtraordinaryGrantDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(10, 1000)
  reason: string;
}

export class CreateExtraordinaryGrantDto extends RevokeExtraordinaryGrantDto {
  @IsInt() @Min(1) idPatient: number;
  @IsInt() @Min(1) idBeneficiary: number;
  @IsEnum(ExtraordinaryGrantType) type: ExtraordinaryGrantType;
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  expiresAt: string;
}
