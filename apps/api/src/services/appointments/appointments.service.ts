import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { User } from 'src/entities/users/users.entity';
import { Doctor } from 'src/entities/doctors/doctors.entity';
import { Schedule } from 'src/entities/schedules/schedule.entity';
import { Specialty } from 'src/entities/specialties/specialties.entity';
import { Appointment, AppointmentStatus } from 'src/entities/appointments/appointment.entity';
import { CreateAppointmentDto } from 'src/dtos/appointments/create-appointment.dto';
import { SchedulesService } from '../schedules/schedules.service';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly schedules: SchedulesService,
  ) {}

  async create(dto: CreateAppointmentDto, idUser: number) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const patient = await manager.getRepository(User).findOne({
          where: { idUser, isActive: true, roles: { name: 'PATIENT', isActive: true } },
        });
        if (!patient) throw new ForbiddenException('Se requiere una cuenta de paciente activa');
        const repository = manager.getRepository(Schedule);
        const initial = await repository.findOne({
          where: { idSchedule: dto.idSchedule },
          relations: { doctor: true },
        });
        if (!initial) throw new NotFoundException('Horario no encontrado');
        // Same lock order as schedule edits and specialty assignment: doctor, then schedule.
        await manager.getRepository(Doctor).findOne({
          where: { idDoctor: initial.doctor.idDoctor },
          lock: { mode: 'pessimistic_write' },
        });
        const locked = await repository.findOne({
          where: { idSchedule: dto.idSchedule },
          lock: { mode: 'pessimistic_write' },
        });
        if (!locked) throw new NotFoundException('Horario no encontrado');
        if (locked.version !== dto.expectedVersion)
          throw new ConflictException('El horario cambió. Consulta nuevamente la disponibilidad');
        // Recheck eligibility after waiting for locks, using the database clock.
        const schedule = await this.schedules
          .availableQuery(manager)
          .andWhere('schedule.idSchedule = :idSchedule', { idSchedule: dto.idSchedule })
          .andWhere(
            '(schedule.date + schedule.startTime) > (clock_timestamp() AT TIME ZONE :timeZone)',
          )
          .getOne();
        if (!schedule) throw new ConflictException('El horario ya no está disponible');
        const specialty = await manager.getRepository(Specialty).findOne({
          where: { idSpecialty: schedule.specialty.idSpecialty, isActive: true },
          lock: { mode: 'pessimistic_read' },
        });
        if (!specialty) throw new ConflictException('La especialidad ya no está disponible');
        const saved = await manager.getRepository(Appointment).save({
          schedule,
          patient,
          doctor: schedule.doctor,
          specialty,
          date: schedule.date,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          status: AppointmentStatus.RESERVED,
          createdBy: idUser,
        });
        return {
          idAppointment: saved.idAppointment,
          idPatient: idUser,
          idSchedule: schedule.idSchedule,
          idDoctor: schedule.doctor.idDoctor,
          idSpecialty: specialty.idSpecialty,
          date: saved.date,
          startTime: saved.startTime,
          endTime: saved.endTime,
          status: saved.status,
          timeZone: 'America/La_Paz',
        };
      });
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string; constraint?: string }).code === '23505' &&
        (error.driverError as { constraint?: string }).constraint === 'UQ_appointments_schedule'
      )
        throw new ConflictException('El horario ya está reservado');
      throw error;
    }
  }
}
