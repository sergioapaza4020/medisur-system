import { UsersQueryDto } from 'src/dtos/users/users-query.dto';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import { UserUpdateDto } from 'src/dtos/users/users-update.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import { UsersAssignRolesDto } from 'src/dtos/users/users-assign-roles.dto';
import { UserCreateDto } from 'src/dtos/users/users.dto';
import { UsersService } from 'src/services/users/users.service';

@ApiBearerAuth('access-token')
@Controller('users')
@ApiTags('Users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Permissions('user.get-all')
  @Get()
  async getAll(@Query() query: UsersQueryDto) {
    return this.usersService.getAll(query);
  }

  @Permissions('user.create', 'user.assign-roles')
  @Post()
  async create(@Body() userCreateDto: UserCreateDto, @CurrentUser() user: JwtPayload) {
    return this.usersService.create(userCreateDto, user.idUser);
  }

  @Permissions('user.get-one-by-email')
  @Get('email/:email')
  async getOneByEmail(@Param('email') email: string) {
    return this.usersService.getOneByEmail(email);
  }

  @Permissions('user.get-one-by-id')
  @Get('id/:idUser')
  async getOneById(@Param('idUser', ParseIntPipe) idUser: number) {
    return this.usersService.getAdministrativeDetail(idUser);
  }

  @Permissions('user.assign-roles')
  @Patch('assign-roles/:idUser')
  async assignRoles(
    @Param('idUser', ParseIntPipe) idUser: number,
    @Body() usersAssignRolesDto: UsersAssignRolesDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.assignRoles(idUser, usersAssignRolesDto.roleNames, user.idUser);
  }

  @Permissions('user.assign-roles')
  @Put('assign-roles/:idUser')
  async replaceRoles(
    @Param('idUser', ParseIntPipe) idUser: number,
    @Body() dto: UsersAssignRolesDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.assignRoles(idUser, dto.roleNames, user.idUser, true);
  }

  @Permissions('user.delete')
  @Delete(':idUser')
  async delete(@Param('idUser', ParseIntPipe) idUser: number, @CurrentUser() user: JwtPayload) {
    return this.usersService.delete(idUser, user.idUser);
  }

  @Permissions('user.reactivate')
  @Patch('reactivate/:idUser')
  async reactivate(@Param('idUser', ParseIntPipe) idUser: number, @CurrentUser() user: JwtPayload) {
    return this.usersService.reactivate(idUser, user.idUser);
  }

  @Permissions('user.update')
  @Patch(':idUser')
  async update(
    @Param('idUser', ParseIntPipe) idUser: number,
    @Body() dto: UserUpdateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.update(idUser, dto, user.idUser);
  }
}
