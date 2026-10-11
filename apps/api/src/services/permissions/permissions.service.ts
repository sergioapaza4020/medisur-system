import { PermissionsQueryDto } from 'src/dtos/permissions/permissions-query.dto';
import { PaginatedResult } from 'src/common/types/pagination.type';
import { paginate } from 'src/common/utils/paginate';
import { statusFilter } from '@common/utils/status-filter';
import { PermissionUpdateDto } from 'src/dtos/permissions/permissions-update.dto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PermissionCreateDto } from 'src/dtos/permissions/permissions.dto';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { Repository } from 'typeorm';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
  ) {}

  async create(permissionCreateDto: PermissionCreateDto, authorId: number): Promise<Permission> {
    permissionCreateDto.name = permissionCreateDto.name.toLowerCase().trim().replace(/\s+/g, '.');
    const permission = await this.permissionRepository.findOne({
      where: { name: permissionCreateDto.name },
    });
    if (permission) throw new BadRequestException('Permission already exists');

    const permissionCreated = this.permissionRepository.create(permissionCreateDto);
    permissionCreated.createdBy = authorId;
    permissionCreated.name = permissionCreateDto.name.toLowerCase().trim().replace(/\s+/g, '.');
    return this.permissionRepository.save(permissionCreated);
  }

  async getAll(
    query: PermissionsQueryDto = new PermissionsQueryDto(),
  ): Promise<PaginatedResult<Permission>> {
    const qb = this.permissionRepository
      .createQueryBuilder('permission')
      .orderBy('permission.name', 'ASC');
    const filter = statusFilter(query.status);
    if (filter.isActive !== undefined) qb.andWhere('permission.isActive = :isActive', filter);
    return paginate(qb, query);
  }

  async getOneByName(name: string) {
    return this.permissionRepository.findOne({
      where: { name, isActive: true },
    });
  }

  async getOneById(idPermission: number) {
    return this.permissionRepository.findOne({
      where: { idPermission, isActive: true },
    });
  }

  async delete(idPermission: number, authorId: number) {
    const permission = await this.permissionRepository.findOne({
      where: { idPermission, isActive: true },
    });
    if (!permission) throw new BadRequestException('Permission not found');
    permission.isActive = false;
    permission.deletedBy = authorId;
    permission.updatedBy = authorId;
    return this.permissionRepository.save(permission);
  }

  async reactivate(idPermission: number, authorId: number) {
    const permission = await this.permissionRepository.findOne({
      where: { idPermission, isActive: false },
    });
    if (!permission) throw new BadRequestException('Permission not found');
    permission.isActive = true;
    permission.updatedBy = authorId;
    return this.permissionRepository.save(permission);
  }

  async update(idPermission: number, dto: PermissionUpdateDto, authorId: number) {
    const record = await this.permissionRepository.findOne({
      where: { idPermission, isActive: true },
    });
    if (!record) throw new BadRequestException('Permission not found');
    const name =
      dto.name === undefined ? undefined : dto.name.toLowerCase().trim().replace(/\s+/g, '.');
    if (name !== undefined) {
      const duplicate = await this.permissionRepository.findOne({ where: { name } });
      if (duplicate && duplicate.idPermission !== idPermission)
        throw new BadRequestException('Permission already exists');
    }

    this.permissionRepository.merge(record, dto, name === undefined ? {} : { name });
    record.updatedBy = authorId;
    return this.permissionRepository.save(record);
  }
}
