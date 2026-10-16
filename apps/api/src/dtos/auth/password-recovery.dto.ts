import { PickType } from '@nestjs/swagger';
import { LoginDto } from './login.dto';

export class PasswordRecoveryDto extends PickType(LoginDto, ['email'] as const) {}
