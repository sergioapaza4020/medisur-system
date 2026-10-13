import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { Doctor } from 'src/entities/doctors/doctors.entity';
import { DoctorSpecialtyHistory } from 'src/entities/doctors/doctor-specialty-history.entity';
import { User } from 'src/entities/users/users.entity';
import {
  DoctorCreateDto,
  DoctorsQueryDto,
  DoctorSpecialtiesDto,
} from 'src/dtos/doctors/doctors.dto';
import { UsersQueryDto } from 'src/dtos/users/users-query.dto';
import { RecordStatus } from 'src/dtos/common/status-query.dto';
import { UsersService } from '../users/users.service';
import { RolesService } from '../roles/roles.service';
import { SpecialtiesService } from '../specialties/specialties.service';
import { paginate } from 'src/common/utils/paginate';
import { statusFilter } from 'src/common/utils/status-filter';
import { PaginationQueryDto } from 'src/dtos/common/pagination-query.dto';
import { PaginatedResult } from 'src/common/types/pagination.type';
import { DoctorSelection, SpecialtySelection } from 'src/common/types/doctor-selection.type';
import { SpecialtiesQueryDto } from 'src/dtos/specialties/specialties.dto';

@Injectable()
export class DoctorsService {
  constructor(
    @InjectRepository(Doctor) private readonly repository: Repository<Doctor>,
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
    private readonly specialtiesService: SpecialtiesService,
  ) {}

  private project(doctor: Doctor, activeSpecialtiesOnly = false) {
    return {
      idDoctor: doctor.idDoctor,
      isActive: doctor.isActive,
      user: {
        idUser: doctor.user.idUser,
        name: doctor.user.name,
        lastname: doctor.user.lastname,
        email: doctor.user.email,
        ci: doctor.user.ci,
        isActive: doctor.user.isActive,
      },
      specialties: (doctor.specialties ?? [])
        .filter((specialty) => !activeSpecialtiesOnly || specialty.isActive)
        .map(({ idSpecialty, name, isActive }) => ({
          idSpecialty,
          name,
          isActive,
        })),
    };
  }

  async getSelectionSpecialties(
    query = new PaginationQueryDto(),
  ): Promise<PaginatedResult<SpecialtySelection>> {
    const result = await this.specialtiesService.getAll(
      Object.assign(new SpecialtiesQueryDto(), query, { status: RecordStatus.ACTIVE }),
    );
    return { ...result, data: result.data.map(({ idSpecialty, name }) => ({ idSpecialty, name })) };
  }

  // Shared operational consultation for selection, schedules and appointments.
  // Availability here means an active profile, not a free appointment slot.
  async getBySpecialty(
    idSpecialty: number,
    query = new PaginationQueryDto(),
  ): Promise<PaginatedResult<DoctorSelection>> {
    await this.specialtiesService.getActiveById(idSpecialty);
    const qb = this.repository
      .createQueryBuilder('doctor')
      .innerJoinAndSelect('doctor.user', 'user')
      .innerJoin(
        'doctor.specialties',
        'specialty',
        'specialty.idSpecialty = :idSpecialty AND specialty.isActive = true',
        { idSpecialty },
      )
      .innerJoin(
        'user.roles',
        'doctorRole',
        'doctorRole.name = :doctorRoleName AND doctorRole.isActive = true',
        { doctorRoleName: 'DOCTOR' },
      )
      .select(['doctor.idDoctor', 'user.idUser', 'user.name', 'user.lastname'])
      .andWhere('doctor.isActive = true')
      .andWhere('user.isActive = true')
      .orderBy('doctor.idDoctor', 'ASC');
    const result = await paginate(qb, query);
    return {
      ...result,
      data: result.data.map(({ idDoctor, user }) => ({
        idDoctor,
        name: user.name,
        lastname: user.lastname,
      })),
    };
  }

  async searchRegistrationUsers(query: UsersQueryDto) {
    if (!query.search || query.search.trim().length < 3)
      throw new BadRequestException('Ingresa al menos 3 caracteres para buscar una cuenta');
    const result = await this.usersService.getAll(query);
    return {
      ...result,
      data: result.data.map(({ idUser, name, lastname, email, ci, isActive }) => ({
        idUser,
        name,
        lastname,
        email,
        ci,
        isActive,
      })),
    };
  }

  async getAll(query = new DoctorsQueryDto()) {
    const qb = this.repository
      .createQueryBuilder('doctor')
      .innerJoinAndSelect('doctor.user', 'user')
      .leftJoinAndSelect('doctor.specialties', 'specialty')
      .orderBy('doctor.idDoctor', 'ASC');
    const filter = statusFilter(query.status);
    if (filter.isActive !== undefined) qb.andWhere('doctor.isActive = :isActive', filter);
    if (!query.status || query.status === RecordStatus.ACTIVE) {
      qb.andWhere('user.isActive = true');
      qb.innerJoin(
        'user.roles',
        'doctorRole',
        'doctorRole.name = :doctorRoleName AND doctorRole.isActive = true',
        { doctorRoleName: 'DOCTOR' },
      );
    }
    if (query.search?.trim())
      qb.andWhere(
        '(user.name ILIKE :search OR user.lastname ILIKE :search OR user.email ILIKE :search OR user.ci ILIKE :search)',
        {
          search:
            '%' + query.search.trim().replace(/[\\%_]/g, (character) => '\\' + character) + '%',
        },
      );
    const result = await paginate(qb, query);
    return {
      ...result,
      data: result.data.map((doctor) =>
        this.project(doctor, !query.status || query.status === RecordStatus.ACTIVE),
      ),
    };
  }

  async getActiveById(idDoctor: number) {
    const doctor = await this.repository.findOne({
      where: {
        idDoctor,
        isActive: true,
        user: { isActive: true, roles: { name: 'DOCTOR', isActive: true } },
      },
      relations: { user: { roles: true }, specialties: true },
    });
    if (!doctor) throw new BadRequestException('Médico activo no encontrado');
    doctor.specialties = (doctor.specialties ?? []).filter(({ isActive }) => isActive);
    return doctor;
  }

  async create(dto: DoctorCreateDto, authorId: number) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const users = manager.getRepository(User);
        // Serialize registrations/role changes for the same identity.
        const user = await users.findOne({
          where: { idUser: dto.idUser, isActive: true },
          lock: { mode: 'pessimistic_write' },
        });
        if (!user) throw new BadRequestException('Selecciona una cuenta activa existente');
        const doctors = manager.getRepository(Doctor);
        if (await doctors.findOne({ where: { user: { idUser: dto.idUser } }, withDeleted: true }))
          throw new BadRequestException('Este usuario ya tiene un perfil médico');
        const role = await this.rolesService.getOneByName('DOCTOR', manager);
        if (!role) throw new BadRequestException('El rol DOCTOR no está disponible');
        const specialties: Doctor['specialties'] = [];
        // Stable lock order prevents conflicts between overlapping specialty selections.
        for (const id of [...(dto.specialtyIds ?? [])].sort((a, b) => a - b))
          specialties.push(await this.specialtiesService.getActiveById(id, manager));
        const assigned = await users.findOne({
          where: { idUser: dto.idUser },
          relations: { roles: true },
        });
        if (!assigned?.roles.some(({ idRole }) => idRole === role.idRole))
          await this.usersService.assignRoles(dto.idUser, ['DOCTOR'], authorId, false, manager);
        const doctor = await doctors.save(
          doctors.create({
            user,
            specialties,
            isActive: dto.isActive ?? true,
            createdBy: authorId,
          }),
        );
        if (specialties.length)
          await manager.getRepository(DoctorSpecialtyHistory).save(
            specialties.map((specialty) => ({
              doctor,
              specialty,
              assigned: true,
              createdBy: authorId,
            })),
          );
        return this.project(doctor);
      });
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      )
        throw new BadRequestException('Este usuario ya tiene un perfil médico');
      throw error;
    }
  }

  async changeStatus(idDoctor: number, isActive: boolean, authorId: number) {
    const doctor = await this.repository.findOne({
      where: { idDoctor },
      relations: { user: true, specialties: true },
    });
    if (!doctor) throw new BadRequestException('Médico no encontrado');
    if (isActive && !doctor.user.isActive)
      throw new BadRequestException('La cuenta del médico está inactiva');
    doctor.isActive = isActive;
    doctor.updatedBy = authorId;
    if (!isActive) doctor.deletedBy = authorId;
    // Save only scalar fields so status changes cannot overwrite concurrent assignments.
    await this.repository.save({
      idDoctor,
      isActive,
      updatedBy: authorId,
      ...(!isActive ? { deletedBy: authorId } : {}),
    });
    return this.project(doctor);
  }

  async getSpecialties(idDoctor: number) {
    const doctor = await this.repository.findOne({
      where: { idDoctor },
      relations: { user: true, specialties: true },
    });
    if (!doctor) throw new BadRequestException('Médico no encontrado');
    return this.project(doctor);
  }

  async assignSpecialties(idDoctor: number, dto: DoctorSpecialtiesDto, authorId: number) {
    return this.dataSource.transaction(async (manager) => {
      const doctors = manager.getRepository(Doctor);
      // Lock without joins (PostgreSQL cannot lock the nullable side of an outer join).
      const locked = await doctors.findOne({
        where: { idDoctor },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new BadRequestException('Médico no encontrado');
      const doctor = await doctors.findOne({
        where: { idDoctor },
        relations: { user: { roles: true }, specialties: true },
      });
      if (!doctor) throw new BadRequestException('Médico no encontrado');
      const existing = new Map(
        doctor.specialties.map((specialty) => [specialty.idSpecialty, specialty]),
      );
      const requested = new Set(dto.specialtyIds);
      if (requested.size !== dto.specialtyIds.length)
        throw new BadRequestException('No se permiten especialidades duplicadas');
      const added = dto.specialtyIds.filter((id) => !existing.has(id));
      if (
        added.length &&
        (!doctor.isActive ||
          !doctor.user.isActive ||
          !doctor.user.roles.some((role) => role.name === 'DOCTOR' && role.isActive))
      )
        throw new BadRequestException(
          'Solo un médico activo con cuenta y rol DOCTOR activos puede recibir nuevas especialidades',
        );
      const specialties: Doctor['specialties'] = [];
      for (const id of [...requested].sort((a, b) => a - b)) {
        // Existing inactive assignments may be retained or removed, never newly assigned.
        specialties.push(
          existing.get(id) ?? (await this.specialtiesService.getActiveById(id, manager)),
        );
      }
      const removed = doctor.specialties.filter(({ idSpecialty }) => !requested.has(idSpecialty));
      if (!added.length && !removed.length) return this.project(doctor);
      doctor.specialties = specialties;
      doctor.updatedBy = authorId;
      await doctors.save(doctor);
      await manager.getRepository(DoctorSpecialtyHistory).save([
        ...specialties
          .filter(({ idSpecialty }) => added.includes(idSpecialty))
          .map((specialty) => ({ doctor, specialty, assigned: true, createdBy: authorId })),
        ...removed.map((specialty) => ({
          doctor,
          specialty,
          assigned: false,
          createdBy: authorId,
        })),
      ]);
      return this.project(doctor);
    });
  }
}
