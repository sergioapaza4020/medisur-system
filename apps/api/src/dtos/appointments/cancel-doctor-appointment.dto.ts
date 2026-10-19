import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class CancelDoctorAppointmentDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 500, { message: 'Indica un motivo de cancelación de entre 1 y 500 caracteres' })
  reason: string;
}
