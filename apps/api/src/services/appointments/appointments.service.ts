import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, IsNull, QueryFailedError } from 'typeorm';
import { User } from 'src/entities/users/users.entity';
import { Doctor } from 'src/entities/doctors/doctors.entity';
import { Schedule } from 'src/entities/schedules/schedule.entity';
import { Specialty } from 'src/entities/specialties/specialties.entity';
import { Appointment, AppointmentStatus } from 'src/entities/appointments/appointment.entity';
import { CreateAppointmentDto } from 'src/dtos/appointments/create-appointment.dto';
import { paginate } from '@common/utils/paginate';
import { PaginatedResult } from '@common/types/pagination.type';
import { PatientAppointment } from '@common/types/patient-appointment.type';
import { AppointmentsQueryDto } from 'src/dtos/appointments/appointments-query.dto';
import { CreateAdministrativeAppointmentDto } from 'src/dtos/appointments/create-administrative-appointment.dto';
import { PatientSelectionQueryDto } from 'src/dtos/appointments/patient-selection-query.dto';
import { BookingPatient } from '@common/types/booking-patient.type';
import { DoctorAgendaQueryDto } from 'src/dtos/appointments/doctor-agenda-query.dto';
import { DoctorAppointment } from '@common/types/doctor-appointment.type';
import { SchedulesService } from '../schedules/schedules.service';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly schedules: SchedulesService,
  ) {}

  async cancelMine(idAppointment: number, idUser: number) {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Appointment);
      const initial = await repository.findOne({
        where: { idAppointment, patient: { idUser }, deletedAt: IsNull() },
        withDeleted: true,
        relations: { doctor: true, schedule: true },
      });
      if (!initial) throw new NotFoundException('Cita propia no encontrada');
      // Same order as booking and schedule edits: doctor, schedule, appointment.
      await manager.getRepository(Doctor).findOne({
        where: { idDoctor: initial.doctor.idDoctor },
        withDeleted: true,
        lock: { mode: 'pessimistic_write' },
      });
      await manager.getRepository(Schedule).findOne({
        where: { idSchedule: initial.schedule.idSchedule },
        withDeleted: true,
        lock: { mode: 'pessimistic_write' },
      });
      const locked = await repository
        .createQueryBuilder('appointment')
        .where('appointment.idAppointment = :idAppointment AND appointment.id_patient = :idUser', {
          idAppointment,
          idUser,
        })
        .setLock('pessimistic_write')
        .getOne();
      if (!locked) throw new NotFoundException('Cita propia no encontrada');
      // Evaluate state and the database clock after waiting, within the same atomic update.
      const result = await repository
        .createQueryBuilder()
        .update(Appointment)
        .set({
          status: AppointmentStatus.CANCELLED,
          cancelledAt: () => 'clock_timestamp()',
          cancelledBy: idUser,
          updatedBy: idUser,
        })
        .where('id_appointment = :idAppointment AND id_patient = :idUser', {
          idAppointment,
          idUser,
        })
        .andWhere('status = :status AND is_active = true AND deleted_at IS NULL', {
          status: AppointmentStatus.RESERVED,
        })
        .andWhere('(date + start_time) > (clock_timestamp() AT TIME ZONE :timeZone)', {
          timeZone: 'America/La_Paz',
        })
        .returning(['idAppointment', 'status', 'cancelledAt'])
        .execute();
      if (result.affected !== 1)
        throw new ConflictException(
          'Solo puedes cancelar citas reservadas que aún no hayan comenzado',
        );
      const rows = result.raw as {
        id_appointment: number;
        status: AppointmentStatus;
        cancelled_at: Date;
      }[];
      return {
        idAppointment: rows[0].id_appointment,
        status: rows[0].status,
        cancelledAt: rows[0].cancelled_at,
      };
    });
  }

  async agenda(
    idUser: number,
    query: DoctorAgendaQueryDto,
  ): Promise<PaginatedResult<DoctorAppointment>> {
    const doctor = await this.schedules.ownDoctor(this.dataSource.manager, idUser);
    this.schedules.validateDateRange(query);
    if (query.date === undefined && query.from === undefined)
      throw new BadRequestException('Selecciona una fecha o un rango válido');
    const qb = this.dataSource
      .getRepository(Appointment)
      .createQueryBuilder('appointment')
      .withDeleted()
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('appointment.specialty', 'specialty')
      .select([
        'appointment.idAppointment',
        'appointment.date',
        'appointment.startTime',
        'appointment.endTime',
        'appointment.status',
        'patient.idUser',
        'patient.name',
        'patient.lastname',
        ...(query.mode === 'calendar' ? [] : ['patient.ci']),
        'specialty.idSpecialty',
        'specialty.name',
      ])
      .where('appointment.id_doctor = :idDoctor', { idDoctor: doctor.idDoctor })
      .andWhere('appointment.deletedAt IS NULL');
    if (query.date !== undefined) qb.andWhere('appointment.date = :date', { date: query.date });
    else qb.andWhere('appointment.date BETWEEN :from AND :to', { from: query.from, to: query.to });
    if (query.status !== undefined)
      qb.andWhere('appointment.status = :status', { status: query.status });
    qb.orderBy('appointment.date', 'ASC')
      .addOrderBy('appointment.startTime', 'ASC')
      .addOrderBy('appointment.idAppointment', 'ASC');
    // Calendar periods are bounded to 31 days by the same range validation above.
    // Return the complete period, without silently truncating busy months.
    const result =
      query.mode === 'calendar'
        ? await qb.getMany().then((data) => ({
            data,
            meta: {
              page: 1,
              limit: data.length,
              total: data.length,
              totalPages: data.length ? 1 : 0,
            },
          }))
        : await paginate(qb, query);
    return {
      ...result,
      data: result.data.map((appointment) => ({
        idAppointment: appointment.idAppointment,
        patient: {
          name: appointment.patient?.name ?? 'Paciente',
          lastname: appointment.patient?.lastname ?? '',
          ...(query.mode === 'calendar' ? {} : { ci: appointment.patient?.ci ?? '' }),
        },
        specialty: { name: appointment.specialty?.name ?? 'Especialidad no disponible' },
        date: appointment.date,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.status,
        timeZone: 'America/La_Paz',
      })),
    };
  }

  async mine(
    idUser: number,
    query: AppointmentsQueryDto,
  ): Promise<PaginatedResult<PatientAppointment>> {
    // Preserve historical names even when related profiles have been deactivated/deleted.
    // The patient predicate is mandatory and never comes from query parameters.
    const qb = this.dataSource
      .getRepository(Appointment)
      .createQueryBuilder('appointment')
      .withDeleted()
      .leftJoinAndSelect('appointment.doctor', 'doctor')
      .leftJoinAndSelect('doctor.user', 'doctorUser')
      .leftJoinAndSelect('appointment.specialty', 'specialty')
      .select([
        'appointment.idAppointment',
        'appointment.date',
        'appointment.startTime',
        'appointment.endTime',
        'appointment.status',
        'doctor.idDoctor',
        'doctorUser.idUser',
        'doctorUser.name',
        'doctorUser.lastname',
        'specialty.idSpecialty',
        'specialty.name',
      ])
      .where('appointment.id_patient = :idUser', { idUser })
      .andWhere('appointment.deletedAt IS NULL');
    if (query.period !== 'all')
      qb.andWhere(
        `(appointment.date + appointment.startTime) ${query.period === 'past' ? '<' : '>='} (CURRENT_TIMESTAMP AT TIME ZONE :timeZone)`,
        { timeZone: 'America/La_Paz' },
      );
    if (query.status !== undefined)
      qb.andWhere('appointment.status = :status', { status: query.status });
    if (query.date !== undefined) qb.andWhere('appointment.date = :date', { date: query.date });
    const direction = query.period === 'past' ? 'DESC' : 'ASC';
    qb.orderBy('appointment.date', direction)
      .addOrderBy('appointment.startTime', direction)
      .addOrderBy('appointment.idAppointment', direction);
    const result = await paginate(qb, query);
    return {
      ...result,
      data: result.data.map((appointment) => ({
        idAppointment: appointment.idAppointment,
        doctor: {
          name: appointment.doctor?.user?.name ?? 'Médico',
          lastname: appointment.doctor?.user?.lastname ?? '',
        },
        specialty: { name: appointment.specialty?.name ?? 'Especialidad no disponible' },
        date: appointment.date,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.status,
        timeZone: 'America/La_Paz',
      })),
    };
  }

  async patients(query: PatientSelectionQueryDto): Promise<PaginatedResult<BookingPatient>> {
    const qb = this.dataSource
      .getRepository(User)
      .createQueryBuilder('patient')
      .innerJoin('patient.roles', 'role', 'role.name = :role AND role.isActive = true', {
        role: 'PATIENT',
      })
      .select(['patient.idUser', 'patient.name', 'patient.lastname', 'patient.ci'])
      .where('patient.isActive = true')
      .andWhere(
        '(patient.name ILIKE :search OR patient.lastname ILIKE :search OR patient.ci ILIKE :search)',
        { search: `%${query.search.replace(/[\\%_]/g, '\\$&')}%` },
      )
      .orderBy('patient.idUser', 'ASC');
    const result = await paginate(qb, query);
    return {
      ...result,
      data: result.data.map(({ idUser, name, lastname, ci }) => ({ idUser, name, lastname, ci })),
    };
  }

  create(dto: CreateAppointmentDto, idUser: number) {
    return this.reserve(dto, idUser, idUser);
  }

  createForPatient(dto: CreateAdministrativeAppointmentDto, actorId: number) {
    return this.reserve(dto, dto.idPatient, actorId);
  }

  private async reserve(dto: CreateAppointmentDto, idPatient: number, actorId: number) {
    try {
      return await this.dataSource.transaction(async (manager) => {
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
        // Revalidate and hold the target account after waiting for the shared doctor lock.
        const patient = await manager
          .getRepository(User)
          .createQueryBuilder('patient')
          .innerJoin('patient.roles', 'role', 'role.name = :role AND role.isActive = true', {
            role: 'PATIENT',
          })
          .where('patient.idUser = :idPatient AND patient.isActive = true', { idPatient })
          .setLock('pessimistic_read', undefined, ['patient'])
          .getOne();
        if (!patient) {
          if (actorId === idPatient)
            throw new ForbiddenException('Se requiere una cuenta de paciente activa');
          throw new ConflictException(
            'El paciente seleccionado no existe o ya no tiene una cuenta de paciente activa. Vuelve a buscarlo',
          );
        }
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
          createdBy: actorId,
        });
        return {
          idAppointment: saved.idAppointment,
          idPatient,
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
