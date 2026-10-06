import { Controller, Get, Patch, Param, ParseIntPipe, Post, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { SessionsService } from 'src/services/sessions/sessions.service';
import { User } from 'src/entities/users/users.entity';
import { LogoutDto } from 'src/dtos/sessions/logout.dto';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';

@ApiBearerAuth('access-token')
@Controller('sessions')
@ApiTags('Sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Permissions('session.get-all')
  @Get()
  async getAllSessions() {
    const sessions = await this.sessionsService.getAllSessions();

    return {
      message: 'Sesiones recuperadas con éxito',
      data: sessions,
    };
  }

  @Post('logout')
  async logout(@Body() logoutDto: LogoutDto, @CurrentUser() user: User) {
    await this.sessionsService.logout(logoutDto.refreshToken, user);

    return { message: 'Logout successful' };
  }

  @Permissions('session.revoke-one')
  @Patch('revoke/:idSession')
  async revokeSession(@Param('idSession', ParseIntPipe) idSession: number) {
    const session = await this.sessionsService.revokeSessionById(idSession);

    return {
      message: 'Session revoked successfully',
      data: session,
    };
  }

  @Permissions('session.revoke-all')
  @Patch('revoke-all')
  async revokeAllSessions(@CurrentUser() user: User) {
    await this.sessionsService.revokeAllSessions(user.idUser);

    return {
      message: 'All sessions revoked successfully',
    };
  }
}
