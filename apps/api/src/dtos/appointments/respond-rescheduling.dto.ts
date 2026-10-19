import { IsIn } from 'class-validator';

export class RespondReschedulingDto {
  @IsIn(['ACCEPTED', 'REJECTED'], { message: 'Selecciona aceptar o rechazar la propuesta' })
  status: 'ACCEPTED' | 'REJECTED';
}
