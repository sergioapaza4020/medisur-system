import { Permissions } from '@core/decorators/permissions/permissions.decorator';
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
import { RolesAssignPermissionsDto } from 'src/dtos/roles/role-assign-permissions.dto';
import { RoleUpdateDto } from 'src/dtos/roles/role-update.dto';
import {
  RoleAdministrativeCreateDto,
  RoleAdministrativeUpdateDto,
} from 'src/dtos/roles/role-administration.dto';
import { RolesQueryDto } from 'src/dtos/roles/roles-query.dto';
import { RolesService } from 'src/services/roles/roles.service';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import type { JwtPayload } from '@common/types/jwt-payload.type';

@ApiBearerAuth('access-token')
@Controller('roles')
@ApiTags('Roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Permissions('role.get-all')
  @Get()
  async getAll(@Query() query: RolesQueryDto) {
    return this.rolesService.getAll(query);
  }

  @Permissions('role.create')
  @Post()
  async create(
    @Body() roleCreateDto: RoleAdministrativeCreateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.rolesService.create(
      { name: roleCreateDto.name, description: roleCreateDto.description, permissionNames: [] },
      user.idUser,
    );
  }

  @Permissions('role.get-one-by-name')
  @Get('name/:name')
  async getOneByName(@Param('name') name: string) {
    return this.rolesService.getOneByName(name);
  }

  @Permissions('role.get-one-by-id')
  @Get('id/:idRole')
  async getOneById(@Param('idRole', ParseIntPipe) idRole: number) {
    return this.rolesService.getOneById(idRole);
  }

  @Permissions('role.assign-permissions')
  @Patch('assign-permissions/:idRole')
  async assignPermissions(
    @Param('idRole', ParseIntPipe) idRole: number,
    @Body() roleAssignPermissionDto: RolesAssignPermissionsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.rolesService.assignPermissions(
      idRole,
      roleAssignPermissionDto.permissionNames,
      user.idUser,
    );
  }

  @Permissions('role.update', 'role.assign-permissions')
  @Put(':idRole')
  async update(
    @Param('idRole', ParseIntPipe) idRole: number,
    @Body() roleUpdateDto: RoleUpdateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.rolesService.update(idRole, roleUpdateDto, user.idUser);
  }

  @Permissions('role.assign-permissions')
  @Put('assign-permissions/:idRole')
  async replacePermissions(
    @Param('idRole', ParseIntPipe) idRole: number,
    @Body() dto: RolesAssignPermissionsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.rolesService.assignPermissions(idRole, dto.permissionNames, user.idUser, true);
  }

  @Permissions('role.update')
  @Patch(':idRole')
  async updateAdministrative(
    @Param('idRole', ParseIntPipe) idRole: number,
    @Body() dto: RoleAdministrativeUpdateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.rolesService.updateAdministrative(idRole, dto, user.idUser);
  }

  @Permissions('role.delete')
  @Delete(':idRole')
  async delete(@Param('idRole', ParseIntPipe) idRole: number, @CurrentUser() user: JwtPayload) {
    return this.rolesService.delete(idRole, user.idUser);
  }

  @Permissions('role.reactivate')
  @Patch('reactivate/:idRole')
  async reactivate(@Param('idRole', ParseIntPipe) idRole: number, @CurrentUser() user: JwtPayload) {
    return this.rolesService.reactivate(idRole, user.idUser);
  }
}
