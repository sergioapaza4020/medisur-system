import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Doctor } from 'src/entities/doctors/doctors.entity';
import { Schedule } from 'src/entities/schedules/schedule.entity';
import { Specialty } from 'src/entities/specialties/specialties.entity';
import { CreateScheduleDto } from 'src/dtos/schedules/create-schedule.dto';
import { PaginationQueryDto } from 'src/dtos/common/pagination-query.dto';
import { paginate } from '@common/utils/paginate';

import { AvailabilityQueryDto } from 'src/dtos/schedules/availability-query.dto';
import { AvailabilityBlock } from '@common/types/availability.type';
import { PaginatedResult } from '@common/types/pagination.type';

import { UpdateScheduleDto } from 'src/dtos/schedules/update-schedule.dto';
import { ScheduleHistory, ScheduleState } from 'src/entities/schedules/schedule-history.entity';

@Injectable()
export class SchedulesService {
  constructor(private readonly dataSource: DataSource) {}

  async availability(query: AvailabilityQueryDto): Promise<PaginatedResult<AvailabilityBlock>> {
    if (query.from !== undefined || query.to !== undefined) {
      const days =
        (Date.parse(`${query.to}T00:00:00Z`) - Date.parse(`${query.from}T00:00:00Z`)) / 86400000;
      if (query.date !== undefined || !Number.isFinite(days) || days < 0 || days > 30)
        throw new BadRequestException(
          'Selecciona un rango válido de hasta 31 días, sin combinarlo con date',
        );
    }
    const qb = this.dataSource
      .getRepository(Schedule)
      .createQueryBuilder('schedule')
      .innerJoinAndSelect('schedule.doctor', 'doctor', 'doctor.isActive = true')
      .innerJoin('doctor.user', 'user', 'user.isActive = true')
      .innerJoin(
        'user.roles',
        'doctorRole',
        'doctorRole.name = :roleName AND doctorRole.isActive = true',
        { roleName: 'DOCTOR' },
      )
      .innerJoinAndSelect('schedule.specialty', 'specialty', 'specialty.isActive = true')
      .innerJoin(
        'doctor.specialties',
        'assignment',
        'assignment.idSpecialty = specialty.idSpecialty',
      )
      .select([
        'schedule.idSchedule',
        'schedule.date',
        'schedule.startTime',
        'schedule.endTime',
        'doctor.idDoctor',
        'specialty.idSpecialty',
      ])
      .where('doctor.idDoctor = :idDoctor', { idDoctor: query.idDoctor })
      .andWhere('schedule.isActive = true')
      .andWhere('schedule.startTime < schedule.endTime')
      .andWhere(
        '(schedule.date + schedule.startTime) > (CURRENT_TIMESTAMP AT TIME ZONE :timeZone)',
        { timeZone: 'America/La_Paz' },
      )
      .orderBy('schedule.date', 'ASC')
      .addOrderBy('schedule.startTime', 'ASC')
      .addOrderBy('schedule.idSchedule', 'ASC');
    if (query.date !== undefined) qb.andWhere('schedule.date = :date', { date: query.date });
    else qb.andWhere('schedule.date BETWEEN :from AND :to', { from: query.from, to: query.to });
    if (query.idSpecialty !== undefined)
      qb.andWhere('specialty.idSpecialty = :idSpecialty', { idSpecialty: query.idSpecialty });
    // EPIC-04: exclude occupied intervals here, before pagination/counting.
    // Keep the projected interval contract; never persist derived availability.
    const result = await paginate(qb, query);
    return {
      ...result,
      data: result.data.map((block) => ({
        idSchedule: block.idSchedule,
        idDoctor: block.doctor.idDoctor,
        idSpecialty: block.specialty.idSpecialty,
        date: block.date,
        startTime: block.startTime,
        endTime: block.endTime,
        timeZone: 'America/La_Paz',
      })),
    };
  }

  private async ownDoctor(manager: EntityManager, idUser: number) {
    const doctor = await manager.getRepository(Doctor).findOne({
      where: {
        user: { idUser, isActive: true, roles: { name: 'DOCTOR', isActive: true } },
        isActive: true,
      },
    });
    if (!doctor)
      throw new ForbiddenException('Se requiere un perfil médico activo asociado a tu cuenta');
    return doctor;
  }

  async specialties(idUser: number, query: PaginationQueryDto) {
    const doctor = await this.ownDoctor(this.dataSource.manager, idUser);
    const qb = this.dataSource
      .getRepository(Specialty)
      .createQueryBuilder('specialty')
      .innerJoin(
        'doctor_specialty',
        'assignment',
        'assignment.id_specialty = specialty.idSpecialty AND assignment.id_doctor = :id',
        { id: doctor.idDoctor },
      )
      .where('specialty.isActive = true')
      .orderBy('specialty.idSpecialty', 'ASC');
    const result = await paginate(qb, query);
    return { ...result, data: result.data.map(({ idSpecialty, name }) => ({ idSpecialty, name })) };
  }

  private state(schedule: Schedule): ScheduleState {
    return {
      idSpecialty: schedule.specialty.idSpecialty,
      date: schedule.date,
      startTime: schedule.startTime.slice(0, 5),
      endTime: schedule.endTime.slice(0, 5),
      isActive: schedule.isActive,
      version: schedule.version,
    };
  }

  private project(schedule: Schedule) {
    return {
      idSchedule: schedule.idSchedule,
      idDoctor: schedule.doctor.idDoctor,
      ...this.state(schedule),
      specialtyName: schedule.specialty.name,
    };
  }

  async mine(idUser: number, query: PaginationQueryDto) {
    const doctor = await this.ownDoctor(this.dataSource.manager, idUser);
    const qb = this.dataSource
      .getRepository(Schedule)
      .createQueryBuilder('schedule')
      .innerJoinAndSelect('schedule.doctor', 'doctor')
      .innerJoinAndSelect('schedule.specialty', 'specialty')
      .where('doctor.idDoctor = :idDoctor', { idDoctor: doctor.idDoctor })
      .orderBy('schedule.date', 'DESC')
      .addOrderBy('schedule.startTime', 'ASC')
      .addOrderBy('schedule.idSchedule', 'ASC');
    const result = await paginate(qb, query);
    return { ...result, data: result.data.map((schedule) => this.project(schedule)) };
  }

  private validateInterval(dto: CreateScheduleDto) {
    if (dto.startTime >= dto.endTime)
      throw new BadRequestException('La hora de inicio debe ser anterior a la hora de fin');
    if (dto.date.startsWith('0000-')) throw new BadRequestException('La fecha debe ser válida');
  }

  private async activeSpecialty(manager: EntityManager, doctor: Doctor, idSpecialty: number) {
    const specialty = await manager.getRepository(Specialty).findOne({
      where: { idSpecialty, isActive: true },
      lock: { mode: 'pessimistic_read' },
    });
    const assigned = await manager.getRepository(Doctor).findOne({
      where: { idDoctor: doctor.idDoctor, specialties: { idSpecialty } },
    });
    if (!specialty || !assigned)
      throw new BadRequestException(
        'Selecciona una especialidad activa asignada a tu perfil médico',
      );
    return specialty;
  }

  private async assertNoOverlap(
    manager: EntityManager,
    doctor: Doctor,
    dto: CreateScheduleDto,
    exceptId?: number,
  ) {
    const qb = manager
      .getRepository(Schedule)
      .createQueryBuilder('schedule')
      .where('schedule.id_doctor = :id', { id: doctor.idDoctor })
      .andWhere('schedule.date = :date', { date: dto.date })
      .andWhere('schedule.isActive = true')
      .andWhere('schedule.startTime < :end AND schedule.endTime > :start', {
        start: dto.startTime,
        end: dto.endTime,
      });
    if (exceptId !== undefined) qb.andWhere('schedule.idSchedule <> :exceptId', { exceptId });
    if (await qb.getExists())
      throw new BadRequestException('El horario se solapa con otro bloque activo del médico');
  }

  private async assertAppointmentsAllowChange(manager: EntityManager) {
    // Fail closed when EPIC-04 is installed. Replace with an affected-appointments
    // check in THIS transaction, using the same doctor lock as appointment booking.
    const rows: { present: boolean }[] = await manager.query(
      "SELECT to_regclass('appointments') IS NOT NULL AS present",
    );
    if (rows[0]?.present !== false)
      throw new ConflictException(
        'La edición de horarios está bloqueada hasta integrar la validación de citas de EPIC-04',
      );
  }

  async update(idSchedule: number, dto: UpdateScheduleDto, idUser: number) {
    this.validateInterval(dto);
    return this.dataSource.transaction(async (manager) => {
      const own = await this.ownDoctor(manager, idUser);
      await manager
        .getRepository(Doctor)
        .findOne({ where: { idDoctor: own.idDoctor }, lock: { mode: 'pessimistic_write' } });
      const doctor = await this.ownDoctor(manager, idUser);
      const repository = manager.getRepository(Schedule);
      // Lock only the schedule row; relation filters in findOne add an outer join
      // which PostgreSQL cannot lock with an unrestricted FOR UPDATE.
      const locked = await repository
        .createQueryBuilder('schedule')
        .where('schedule.idSchedule = :idSchedule', { idSchedule })
        .andWhere('schedule.id_doctor = :idDoctor', { idDoctor: doctor.idDoctor })
        .setLock('pessimistic_write')
        .getOne();
      if (!locked) throw new NotFoundException('Horario propio no encontrado');
      const current = await repository.findOne({
        where: { idSchedule },
        relations: { doctor: true, specialty: true },
      });
      if (!current) throw new NotFoundException('Horario propio no encontrado');
      if (current.version !== dto.expectedVersion)
        throw new ConflictException('El horario cambió. Recarga sus valores antes de modificarlo');
      const before = this.state(current);
      const unchanged =
        before.idSpecialty === dto.idSpecialty &&
        before.date === dto.date &&
        before.startTime === dto.startTime &&
        before.endTime === dto.endTime;
      if (unchanged && before.isActive === dto.isActive) return this.project(current);
      await this.assertAppointmentsAllowChange(manager);
      const specialty =
        unchanged && !dto.isActive
          ? current.specialty
          : await this.activeSpecialty(manager, doctor, dto.idSpecialty);
      if (dto.isActive) await this.assertNoOverlap(manager, doctor, dto, idSchedule);
      const saved = await repository.save({
        idSchedule,
        specialty,
        date: dto.date,
        startTime: dto.startTime,
        endTime: dto.endTime,
        isActive: dto.isActive,
        updatedBy: idUser,
        version: current.version + 1,
      });
      const updated = { ...current, ...saved, doctor, specialty };
      await manager
        .getRepository(ScheduleHistory)
        .save({ schedule: current, before, after: this.state(updated), createdBy: idUser });
      return this.project(updated);
    });
  }

  async create(dto: CreateScheduleDto, idUser: number) {
    this.validateInterval(dto);
    return this.dataSource.transaction(async (manager) => {
      const own = await this.ownDoctor(manager, idUser);
      // Serialize all schedule creation and specialty assignments for the same doctor.
      await manager
        .getRepository(Doctor)
        .findOne({ where: { idDoctor: own.idDoctor }, lock: { mode: 'pessimistic_write' } });
      const doctor = await this.ownDoctor(manager, idUser);
      const specialty = await this.activeSpecialty(manager, doctor, dto.idSpecialty);
      const repository = manager.getRepository(Schedule);
      await this.assertNoOverlap(manager, doctor, dto);
      const saved = await repository.save(
        repository.create({ ...dto, doctor, specialty, createdBy: idUser }),
      );
      return {
        idSchedule: saved.idSchedule,
        idDoctor: doctor.idDoctor,
        idSpecialty: specialty.idSpecialty,
        date: saved.date,
        startTime: saved.startTime,
        endTime: saved.endTime,
        isActive: saved.isActive,
        version: saved.version,
      };
    });
  }
}
