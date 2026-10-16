import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '@core/decorators/public/public.decorator';
import { PasswordRecoveryDto } from 'src/dtos/auth/password-recovery.dto';
import {
  PasswordRecoveryService,
  PASSWORD_RECOVERY_MESSAGE,
} from 'src/services/auth/password-recovery.service';

@Controller('auth')
@ApiTags('Auth')
export class PasswordRecoveryController {
  constructor(private readonly recovery: PasswordRecoveryService) {}

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  async request(@Body() dto: PasswordRecoveryDto, @Req() request: Request) {
    await this.recovery.request(dto.email, request.ip || request.socket.remoteAddress || 'unknown');
    return { message: PASSWORD_RECOVERY_MESSAGE, data: null };
  }
}
