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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolesAssignPermissionsDto } from 'src/dtos/roles/role-assign-permissions.dto';
import { RoleUpdateDto } from 'src/dtos/roles/role-update.dto';
import { RoleCreateDto } from 'src/dtos/roles/roles.dto';
import { RolesService } from 'src/services/roles/roles.service';

@ApiBearerAuth('access-token')
@Controller('roles')
@ApiTags('Roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Permissions('role.get-all')
  @Get()
  async getAll() {
    return this.rolesService.getAll();
  }

  @Permissions('role.create')
  @Post()
  async create(@Body() roleCreateDto: RoleCreateDto) {
    return this.rolesService.create(roleCreateDto);
  }

  @Permissions('role.get-one-by-name')
  @Get('name/:name')
  async getOneByName(@Param('name') name: string) {
    return this.rolesService.getOneByName(name);
  }

  @Permissions('role.get-one-by-id')
  @Get('id/:idRole')
  async getOneById(@Param('idRole') idRole: number) {
    return this.rolesService.getOneById(idRole);
  }

  @Permissions('role.assign-permissions')
  @Patch('assign-permissions/:idRole')
  async assignPermissions(
    @Param('idRole', ParseIntPipe) idRole: number,
    @Body() roleAssignPermissionDto: RolesAssignPermissionsDto,
  ) {
    return this.rolesService.assignPermissions(idRole, roleAssignPermissionDto.permissionNames);
  }

  @Permissions('role.update')
  @Put(':idRole')
  async update(
    @Param('idRole', ParseIntPipe) idRole: number,
    @Body() roleUpdateDto: RoleUpdateDto,
  ) {
    return this.rolesService.update(idRole, roleUpdateDto);
  }

  @Permissions('role.delete')
  @Delete(':idRole')
  async delete(@Param('idRole') idRole: number) {
    return this.rolesService.delete(idRole);
  }

  @Permissions('role.reactivate')
  @Patch('reactivate/:idRole')
  async reactivate(@Param('idRole') idRole: number) {
    return this.rolesService.reactivate(idRole);
  }
}
