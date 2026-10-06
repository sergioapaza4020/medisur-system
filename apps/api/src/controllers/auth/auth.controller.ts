import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { Public } from '@core/decorators/public/public.decorator';
import { LoginDto } from 'src/dtos/auth/login.dto';
import { AuthService } from 'src/services/auth/auth.service';
import { RefreshTokenDto } from 'src/dtos/auth/refresh-token.dto';
import type { Request } from 'express';
import type { JwtPayload } from '@common/types/jwt-payload.type';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    const tokens = await this.authService.login(loginDto, req);

    return {
      message: 'Login successfully',
      data: tokens,
    };
  }

  @ApiBearerAuth('access-token')
  @Get('me')
  async getProfile(@CurrentUser() user: JwtPayload) {
    const session = await this.authService.getSession(user.idUser, user.idSession);

    return {
      message: 'User session active',
      data: session,
    };
  }

  @Public()
  @Post('refresh-access-token')
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    const tokens = await this.authService.refreshToken(refreshTokenDto.refreshToken);

    return {
      message: 'Token refreshed successfully',
      data: tokens,
    };
  }
}
