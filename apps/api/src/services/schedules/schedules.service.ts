import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Doctor } from 'src/entities/doctors/doctors.entity';
import { Schedule } from 'src/entities/schedules/schedule.entity';
import { Specialty } from 'src/entities/specialties/specialties.entity';
import { CreateScheduleDto } from 'src/dtos/schedules/create-schedule.dto';
import { PaginationQueryDto } from 'src/dtos/common/pagination-query.dto';
import { paginate } from '@common/utils/paginate';

@Injectable()
export class SchedulesService {
  constructor(private readonly dataSource: DataSource) {}

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

  async create(dto: CreateScheduleDto, idUser: number) {
    if (dto.startTime >= dto.endTime)
      throw new BadRequestException('La hora de inicio debe ser anterior a la hora de fin');
    return this.dataSource.transaction(async (manager) => {
      const own = await this.ownDoctor(manager, idUser);
      // Serialize all schedule creation and specialty assignments for the same doctor.
      await manager
        .getRepository(Doctor)
        .findOne({ where: { idDoctor: own.idDoctor }, lock: { mode: 'pessimistic_write' } });
      const doctor = await this.ownDoctor(manager, idUser);
      const specialty = await manager.getRepository(Specialty).findOne({
        where: { idSpecialty: dto.idSpecialty, isActive: true },
        lock: { mode: 'pessimistic_read' },
      });
      const assigned = await manager.getRepository(Doctor).findOne({
        where: { idDoctor: doctor.idDoctor, specialties: { idSpecialty: dto.idSpecialty } },
      });
      if (!specialty || !assigned)
        throw new BadRequestException(
          'Selecciona una especialidad activa asignada a tu perfil médico',
        );
      const repository = manager.getRepository(Schedule);
      const overlap = await repository
        .createQueryBuilder('schedule')
        .where('schedule.id_doctor = :id', { id: doctor.idDoctor })
        .andWhere('schedule.date = :date', { date: dto.date })
        .andWhere('schedule.isActive = true')
        .andWhere('schedule.startTime < :end AND schedule.endTime > :start', {
          start: dto.startTime,
          end: dto.endTime,
        })
        .getExists();
      if (overlap)
        throw new BadRequestException('El horario se solapa con otro bloque activo del médico');
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
      };
    });
  }
}
