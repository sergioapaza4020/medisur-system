import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import { ChangeMyPasswordDto, UpdateMyAccountDto } from 'src/dtos/users/my-account.dto';
import { MyAccountService } from 'src/services/users/my-account.service';
import { AvatarUploadInterceptor } from './avatar-upload.interceptor';

@ApiBearerAuth('access-token')
@ApiTags('My account')
@Controller('users/me')
export class MyAccountController {
  constructor(private readonly account: MyAccountService) {}

  @Get()
  get(@CurrentUser() user: JwtPayload) {
    return this.account.get(user.idUser);
  }

  @Patch()
  update(@CurrentUser() user: JwtPayload, @Body() dto: UpdateMyAccountDto) {
    return this.account.update(user.idUser, dto);
  }

  @Post('avatar')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['avatar'],
      properties: { avatar: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(AvatarUploadInterceptor)
  uploadAvatar(@CurrentUser() user: JwtPayload, @UploadedFile() file?: Express.Multer.File) {
    return this.account.uploadAvatar(user.idUser, file);
  }

  @Delete('avatar')
  deleteAvatar(@CurrentUser() user: JwtPayload) {
    return this.account.deleteAvatar(user.idUser);
  }

  @Post('password')
  async changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangeMyPasswordDto) {
    await this.account.changePassword(user.idUser, dto);
    return { message: 'Contraseña actualizada. Inicia sesión nuevamente.' };
  }

  @Post('deactivate')
  async deactivate(@CurrentUser() user: JwtPayload) {
    await this.account.deactivate(user.idUser);
    return { message: 'Cuenta desactivada' };
  }
}
