import { Query } from '@nestjs/common';
import { StatusQueryDto } from 'src/dtos/common/status-query.dto';
import { PermissionUpdateDto } from 'src/dtos/permissions/permissions-update.dto';
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PermissionCreateDto } from 'src/dtos/permissions/permissions.dto';
import { PermissionsService } from 'src/services/permissions/permissions.service';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { User } from 'src/entities/users/users.entity';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';

@ApiBearerAuth('access-token')
@Controller('permissions')
@ApiTags('Permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Permissions('permission.get-all')
  @Get()
  async getAll(@Query() query: StatusQueryDto) {
    return this.permissionsService.getAll(query.status);
  }

  @Permissions('permission.create')
  @Post()
  async create(@Body() permissionCreateDto: PermissionCreateDto, @CurrentUser() user: User) {
    return this.permissionsService.create(permissionCreateDto, user.idUser);
  }

  @Permissions('permission.get-one-by-name')
  @Get('name/:name')
  async getOneByName(@Param('name') name: string) {
    return this.permissionsService.getOneByName(name);
  }

  @Permissions('permission.get-one-by-id')
  @Get('id/:idPermission')
  async getOneById(@Param('idPermission', ParseIntPipe) idPermission: number) {
    return this.permissionsService.getOneById(idPermission);
  }

  @Permissions('permission.delete')
  @Delete(':idPermission')
  async delete(@Param('idPermission', ParseIntPipe) idPermission: number) {
    return this.permissionsService.delete(idPermission);
  }

  @Permissions('permission.reactivate')
  @Patch('reactivate/:idPermission')
  async reactivate(@Param('idPermission', ParseIntPipe) idPermission: number) {
    return this.permissionsService.reactivate(idPermission);
  }

  @Permissions('permission.update')
  @Patch(':idPermission')
  async update(
    @Param('idPermission', ParseIntPipe) idPermission: number,
    @Body() dto: PermissionUpdateDto,
  ) {
    return this.permissionsService.update(idPermission, dto);
  }
}
