import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RoleCreateDto } from 'src/dtos/roles/roles.dto';
import { Role } from 'src/entities/roles/roles.entity';
import { Repository } from 'typeorm';
import { PermissionsService } from '../permissions/permissions.service';
import { RoleUpdateDto } from 'src/dtos/roles/role-update.dto';
import { Permission } from 'src/entities/permissions/permissions.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly roleRepository: Repository<Role>,
    private readonly permissionsService: PermissionsService,
  ) {}

  async create(roleCreateDto: RoleCreateDto): Promise<Role> {
    const normalizedName = roleCreateDto.name.toUpperCase().trim().replace(/\s+/g, ' ');

    const role = await this.getOneByName(normalizedName);
    if (role) throw new BadRequestException('Role already exists');

    const permissions: Permission[] = [];

    for (const permissionName of new Set(roleCreateDto.permissionNames)) {
      const permission = await this.permissionsService.getOneByName(permissionName);

      if (!permission) {
        throw new BadRequestException(`Permission not found: ${permissionName}`);
      }

      permissions.push(permission);
    }

    const roleCreated = this.roleRepository.create({
      name: normalizedName,
      description: roleCreateDto.description?.trim() || null,
      permissions,
    });
    roleCreated.createdBy = 0;

    return this.roleRepository.save(roleCreated);
  }

  async getAll(): Promise<Role[]> {
    return this.roleRepository.find({
      relations: {
        permissions: true,
      },
    });
  }

  async getOneByName(name: string) {
    return this.roleRepository.findOne({
      where: { name, isActive: true },
    });
  }

  async getOneById(idRole: number) {
    return this.roleRepository.findOne({
      where: { idRole, isActive: true },
    });
  }

  async assignPermissions(idRole: number, permissionNames: string[]) {
    const role = await this.roleRepository.findOne({
      where: { idRole, isActive: true },
      relations: ['permissions'],
    });
    if (!role) throw new BadRequestException('Role not found');
    for (const pn of permissionNames) {
      const permission = await this.permissionsService.getOneByName(pn);
      if (!permission) throw new BadRequestException(`Permission not found: ${pn}`);

      const alreadyAssigned = role.permissions?.some((p) => p.name === pn);
      if (alreadyAssigned) throw new BadRequestException(`Permission already assigned: ${pn}`);

      role.permissions?.push(permission);
    }

    role.updatedAt = new Date();
    return this.roleRepository.save(role);
  }

  async update(idRole: number, roleUpdateDto: RoleUpdateDto): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: {
        idRole,
        isActive: true,
      },
      relations: {
        permissions: true,
      },
    });

    if (!role) {
      throw new BadRequestException('Role not found');
    }

    const normalizedName = roleUpdateDto.name.toUpperCase().trim().replace(/\s+/g, ' ');

    const existingRole = await this.roleRepository.findOne({
      where: {
        name: normalizedName,
        isActive: true,
      },
    });

    if (existingRole && existingRole.idRole !== idRole) {
      throw new BadRequestException('Role already exists');
    }

    const permissions: Permission[] = [];

    for (const permissionName of roleUpdateDto.permissionNames) {
      const permission = await this.permissionsService.getOneByName(permissionName);

      if (!permission) {
        throw new BadRequestException(`Permission not found: ${permissionName}`);
      }

      permissions.push(permission);
    }

    role.name = normalizedName;
    role.description = roleUpdateDto.description?.trim() || null;
    role.permissions = permissions;
    role.updatedAt = new Date();

    return this.roleRepository.save(role);
  }

  async delete(idRole: number) {
    const role = await this.roleRepository.findOne({
      where: { idRole, isActive: true },
    });
    if (!role) throw new BadRequestException('Role not found');
    role.isActive = false;
    return this.roleRepository.save(role);
  }

  async reactivate(idRole: number) {
    const role = await this.roleRepository.findOne({
      where: { idRole, isActive: false },
    });
    if (!role) throw new BadRequestException('Role not found');
    role.isActive = true;
    return this.roleRepository.save(role);
  }
}
