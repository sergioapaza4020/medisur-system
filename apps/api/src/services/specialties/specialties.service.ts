import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { Specialty } from 'src/entities/specialties/specialties.entity';
import { SpecialtiesQueryDto, SpecialtyWriteDto } from 'src/dtos/specialties/specialties.dto';
import {
  formatSpecialtyName,
  normalizeSpecialtyNameForComparison,
} from 'src/common/utils/specialty-name';
import { paginate } from 'src/common/utils/paginate';
import { statusFilter } from 'src/common/utils/status-filter';
import { PaginatedResult } from 'src/common/types/pagination.type';
import { PaginationQueryDto } from 'src/dtos/common/pagination-query.dto';
import { RecordStatus } from 'src/dtos/common/status-query.dto';
import { SpecialtySelection } from 'src/common/types/doctor-selection.type';

@Injectable()
export class SpecialtiesService {
  constructor(@InjectRepository(Specialty) private readonly repository: Repository<Specialty>) {}

  async getPublicPage(query: PaginationQueryDto): Promise<PaginatedResult<SpecialtySelection>> {
    const result = await this.getAll(
      Object.assign(new SpecialtiesQueryDto(), {
        page: query.page,
        limit: query.limit,
        status: RecordStatus.ACTIVE,
      }),
    );
    return { ...result, data: result.data.map(({ idSpecialty, name }) => ({ idSpecialty, name })) };
  }

  async getAll(query = new SpecialtiesQueryDto()): Promise<PaginatedResult<Specialty>> {
    const qb = this.repository
      .createQueryBuilder('specialty')
      .orderBy('specialty.idSpecialty', 'ASC');
    const filter = statusFilter(query.status);
    if (filter.isActive !== undefined) qb.andWhere('specialty.isActive = :isActive', filter);
    if (query.search?.trim())
      qb.andWhere('specialty.name ILIKE :search', {
        search: '%' + query.search.trim().replace(/[\\%_]/g, (character) => '\\' + character) + '%',
      });
    return paginate(qb, query);
  }

  async getOneById(idSpecialty: number) {
    const specialty = await this.repository.findOne({ where: { idSpecialty } });
    if (!specialty) throw new BadRequestException('Especialidad no encontrada');
    return specialty;
  }

  // Operational consumers must resolve active specialties, including on write.
  async getActiveById(idSpecialty: number, manager?: EntityManager) {
    const specialty = await (manager?.getRepository(Specialty) ?? this.repository).findOne({
      where: { idSpecialty, isActive: true },
      ...(manager ? { lock: { mode: 'pessimistic_read' as const } } : {}),
    });
    if (!specialty) throw new BadRequestException('Especialidad activa no encontrada');
    return specialty;
  }

  private async validateName(name: string, idSpecialty?: number) {
    const normalized = formatSpecialtyName(name);
    if (!normalized || normalized.length > 100)
      throw new BadRequestException('El nombre es obligatorio y admite hasta 100 caracteres');
    const comparison = normalizeSpecialtyNameForComparison(normalized);
    const specialties = await this.repository.find({
      select: { idSpecialty: true, name: true },
      withDeleted: true,
    });
    if (
      specialties.some(
        (specialty) =>
          specialty.idSpecialty !== idSpecialty &&
          normalizeSpecialtyNameForComparison(specialty.name) === comparison,
      )
    )
      throw new BadRequestException('La especialidad ya existe');
    return normalized;
  }

  private async save(specialty: Specialty) {
    try {
      return await this.repository.save(specialty);
    } catch (error) {
      // The existing lower(name) index protects case-only concurrent conflicts, not accent variants.
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string; constraint?: string }).code === '23505' &&
        (error.driverError as { constraint?: string }).constraint === 'UQ_specialties_name'
      )
        throw new BadRequestException('La especialidad ya existe');
      throw error;
    }
  }

  async create(dto: SpecialtyWriteDto, authorId: number) {
    const name = await this.validateName(dto.name);
    return this.save(this.repository.create({ name, isActive: true, createdBy: authorId }));
  }

  async update(idSpecialty: number, dto: SpecialtyWriteDto, authorId: number) {
    const specialty = await this.getOneById(idSpecialty);
    specialty.name = await this.validateName(dto.name, idSpecialty);
    specialty.updatedBy = authorId;
    return this.save(specialty);
  }

  async deactivate(idSpecialty: number, authorId: number) {
    const specialty = await this.getOneById(idSpecialty);
    specialty.isActive = false;
    specialty.deletedBy = authorId;
    specialty.updatedBy = authorId;
    return this.save(specialty);
  }

  async reactivate(idSpecialty: number, authorId: number) {
    const specialty = await this.getOneById(idSpecialty);
    specialty.isActive = true;
    specialty.updatedBy = authorId;
    return this.save(specialty);
  }
}
