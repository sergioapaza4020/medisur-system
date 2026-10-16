import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '@core/decorators/public/public.decorator';
import { RecoveryTokenDto, ResetPasswordDto } from 'src/dtos/auth/reset-password.dto';
import { PasswordResetService } from 'src/services/auth/password-reset.service';

@Controller('auth')
@ApiTags('Auth')
export class PasswordResetController {
  constructor(private readonly resetService: PasswordResetService) {}

  @Public()
  @Post('reset-password/validate')
  @HttpCode(200)
  async validate(@Body() dto: RecoveryTokenDto, @Req() request: Request) {
    await this.resetService.checkRate(request.ip || request.socket.remoteAddress || 'unknown');
    await this.resetService.validate(dto.token);
    return { message: 'Enlace válido', data: null };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  async reset(@Body() dto: ResetPasswordDto, @Req() request: Request) {
    await this.resetService.checkRate(request.ip || request.socket.remoteAddress || 'unknown');
    await this.resetService.reset(dto);
    return {
      message: 'Contraseña restablecida correctamente. Inicia sesión con tu nueva contraseña.',
      data: null,
    };
  }
}
