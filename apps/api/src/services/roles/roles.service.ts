import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RoleCreateDto } from 'src/dtos/roles/roles.dto';
import { Role } from 'src/entities/roles/roles.entity';
import { EntityManager, Repository } from 'typeorm';
import { PermissionsService } from '../permissions/permissions.service';
import { RoleUpdateDto } from 'src/dtos/roles/role-update.dto';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { MEDISUR_ROLES } from 'src/database/seeders/access-control.catalog';
import { RolesQueryDto } from 'src/dtos/roles/roles-query.dto';
import { RoleAdministrativeUpdateDto } from 'src/dtos/roles/role-administration.dto';
import { paginate } from 'src/common/utils/paginate';
import { statusFilter } from 'src/common/utils/status-filter';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly roleRepository: Repository<Role>,
    private readonly permissionsService: PermissionsService,
  ) {}

  private isSystemRole(role: Role): boolean {
    return MEDISUR_ROLES.some((base) => base.name === role.name);
  }

  async create(roleCreateDto: RoleCreateDto, authorId: number): Promise<Role> {
    const normalizedName = roleCreateDto.name.toUpperCase().trim().replace(/\s+/g, ' ');

    const role = await this.roleRepository.findOne({ where: { name: normalizedName } });
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
    roleCreated.createdBy = authorId;

    return this.roleRepository.save(roleCreated);
  }

  async getAll(query: RolesQueryDto = new RolesQueryDto()) {
    const qb = this.roleRepository
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.permissions', 'permissions')
      .orderBy('role.idRole', 'ASC');
    const filter = statusFilter(query.status);
    if (filter.isActive !== undefined) qb.andWhere('role.isActive = :isActive', filter);
    if (query.search?.trim())
      qb.andWhere('(role.name ILIKE :search OR role.description ILIKE :search)', {
        search: '%' + query.search.trim().replace(/[\\%_]/g, (character) => '\\' + character) + '%',
      });
    const result = await paginate(qb, query);
    return {
      ...result,
      data: result.data.map((role) => ({
        idRole: role.idRole,
        name: role.name,
        description: role.description,
        isActive: role.isActive,
        isSystem: this.isSystemRole(role),
        permissionCount: role.permissions?.length ?? 0,
      })),
    };
  }

  async updateAdministrative(idRole: number, dto: RoleAdministrativeUpdateDto, authorId: number) {
    const role = await this.roleRepository.findOne({ where: { idRole } });
    if (!role) throw new BadRequestException('Role not found');
    if (dto.description !== undefined) role.description = dto.description.trim() || null;
    role.updatedBy = authorId;
    return this.roleRepository.save(role);
  }

  async getOneByName(name: string, manager?: EntityManager) {
    return (manager?.getRepository(Role) ?? this.roleRepository).findOne({
      where: { name, isActive: true },
    });
  }

  async getOneById(idRole: number) {
    const role = await this.roleRepository.findOne({
      where: { idRole },
      relations: ['permissions'],
    });
    if (!role) throw new BadRequestException('Role not found');
    return role;
  }

  async assignPermissions(
    idRole: number,
    permissionNames: string[],
    authorId: number,
    replace = false,
  ) {
    const role = await this.roleRepository.findOne({
      where: { idRole, isActive: true },
      relations: ['permissions'],
    });
    if (!role) throw new BadRequestException('Role not found');
    const permissions = replace ? [] : [...(role.permissions ?? [])];
    for (const pn of new Set(permissionNames)) {
      // Retaining an inactive association does not reactivate its capability.
      const retained = replace
        ? role.permissions?.find((permission) => permission.name === pn)
        : undefined;
      const permission = retained ?? (await this.permissionsService.getOneByName(pn));
      if (!permission) throw new BadRequestException(`Permission not found: ${pn}`);

      const alreadyAssigned = permissions.some((p) => p.name === pn);
      if (alreadyAssigned) throw new BadRequestException(`Permission already assigned: ${pn}`);

      permissions.push(permission);
    }

    role.permissions = permissions;
    role.updatedBy = authorId;
    role.updatedAt = new Date();
    return this.roleRepository.save(role);
  }

  async update(idRole: number, roleUpdateDto: RoleUpdateDto, authorId: number): Promise<Role> {
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

    if (normalizedName !== role.name)
      throw new BadRequestException('El código interno del rol no puede modificarse');

    const existingRole = await this.roleRepository.findOne({
      where: {
        name: normalizedName,
      },
    });

    if (existingRole && existingRole.idRole !== idRole) {
      throw new BadRequestException('Role already exists');
    }

    const permissions: Permission[] = [];

    for (const permissionName of new Set(roleUpdateDto.permissionNames)) {
      const permission = await this.permissionsService.getOneByName(permissionName);

      if (!permission) {
        throw new BadRequestException(`Permission not found: ${permissionName}`);
      }

      permissions.push(permission);
    }

    role.name = normalizedName;
    role.description = roleUpdateDto.description?.trim() || null;
    role.permissions = permissions;
    role.updatedBy = authorId;
    role.updatedAt = new Date();

    return this.roleRepository.save(role);
  }

  async delete(idRole: number, authorId: number) {
    const role = await this.roleRepository.findOne({
      where: { idRole, isActive: true },
    });
    if (!role) throw new BadRequestException('Role not found');
    if (this.isSystemRole(role))
      throw new BadRequestException('Los roles base no pueden desactivarse');
    role.isActive = false;
    role.deletedBy = authorId;
    role.updatedBy = authorId;
    return this.roleRepository.save(role);
  }

  async reactivate(idRole: number, authorId: number) {
    const role = await this.roleRepository.findOne({
      where: { idRole, isActive: false },
    });
    if (!role) throw new BadRequestException('Role not found');
    role.isActive = true;
    role.updatedBy = authorId;
    return this.roleRepository.save(role);
  }
}
