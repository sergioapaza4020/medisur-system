import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, IsNull, QueryFailedError } from 'typeorm';
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
import {
  ReschedulingProposal,
  ProposalStatus,
} from 'src/entities/appointments/rescheduling-proposal.entity';
import { PaginationQueryDto } from 'src/dtos/common/pagination-query.dto';
import { ReschedulingAvailabilityQueryDto } from 'src/dtos/appointments/rescheduling-availability-query.dto';
import { PatientReschedulingProposal } from '@common/types/rescheduling-proposal.type';
import { RespondReschedulingDto } from 'src/dtos/appointments/respond-rescheduling.dto';
import { SchedulesService } from '../schedules/schedules.service';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly schedules: SchedulesService,
  ) {}

  async respondRescheduling(
    idProposal: number,
    idUser: number,
    status: RespondReschedulingDto['status'],
  ) {
    if (!['ACCEPTED', 'REJECTED'].includes(status))
      throw new BadRequestException('Respuesta de propuesta inválida');
    try {
      return await this.dataSource.transaction(async (manager) => {
        const repository = manager.getRepository(ReschedulingProposal);
        const initial = await repository.findOne({
          where: {
            idProposal,
            isActive: true,
            deletedAt: IsNull(),
            appointment: { patient: { idUser }, isActive: true, deletedAt: IsNull() },
          },
          withDeleted: true,
          relations: { appointment: { doctor: true, specialty: true }, schedule: true },
        });
        if (!initial) throw new NotFoundException('Propuesta propia no encontrada');
        await manager.getRepository(Doctor).findOne({
          where: { idDoctor: initial.appointment.doctor.idDoctor },
          withDeleted: true,
          lock: { mode: 'pessimistic_write' },
        });
        const target =
          status === 'ACCEPTED'
            ? await manager
                .getRepository(Schedule)
                .createQueryBuilder('target')
                .withDeleted()
                .leftJoinAndSelect('target.doctor', 'targetDoctor')
                .leftJoinAndSelect('target.specialty', 'targetSpecialty')
                .where('target.idSchedule = :id', { id: initial.schedule.idSchedule })
                .setLock('pessimistic_write', undefined, ['target'])
                .getOne()
            : null;
        const original = await manager
          .getRepository(Appointment)
          .createQueryBuilder('appointment')
          .where('appointment.idAppointment = :id AND appointment.id_patient = :idUser', {
            id: initial.appointment.idAppointment,
            idUser,
          })
          .andWhere('appointment.isActive = true')
          .setLock('pessimistic_write')
          .getOne();
        if (!original) throw new NotFoundException('Propuesta propia no encontrada');
        const proposal = await repository
          .createQueryBuilder('proposal')
          .where('proposal.idProposal = :idProposal AND proposal.id_appointment = :idAppointment', {
            idProposal,
            idAppointment: original.idAppointment,
          })
          .andWhere('proposal.isActive = true')
          .setLock('pessimistic_write')
          .getOne();
        if (!proposal) throw new NotFoundException('Propuesta propia no encontrada');
        if (proposal.status !== ProposalStatus.PENDING)
          throw new ConflictException('La propuesta ya fue respondida');
        if (
          original.status !== AppointmentStatus.CANCELLED ||
          (await repository.existsBy({
            appointment: { idAppointment: original.idAppointment },
            status: ProposalStatus.ACCEPTED,
          }))
        )
          throw new ConflictException('La cita ya no admite esta reprogramación');
        let resultingAppointment: Appointment | null = null;
        if (status === 'ACCEPTED') {
          if (
            !target ||
            target.version !== proposal.scheduleVersion ||
            target.date !== proposal.date ||
            target.startTime !== proposal.startTime ||
            target.endTime !== proposal.endTime ||
            target.doctor?.idDoctor !== initial.appointment.doctor.idDoctor ||
            target.specialty?.idSpecialty !== initial.appointment.specialty.idSpecialty
          )
            throw new ConflictException(
              'El horario propuesto cambió. Solicita una nueva propuesta',
            );
          const booked = await this.reserveWithin(
            manager,
            { idSchedule: target.idSchedule, expectedVersion: proposal.scheduleVersion },
            idUser,
            idUser,
          );
          resultingAppointment = { idAppointment: booked.idAppointment } as Appointment;
        }
        // The new reservation, decision and durable notification context commit or roll back together.
        const updated = await repository.update(
          { idProposal, status: ProposalStatus.PENDING },
          {
            status: status as ProposalStatus,
            respondedAt: () => 'clock_timestamp()',
            respondedBy: idUser,
            updatedBy: idUser,
            resultingAppointment,
          },
        );
        if (updated.affected !== 1) throw new ConflictException('La propuesta ya fue respondida');
        const saved = await repository.findOneOrFail({
          where: { idProposal },
          relations: { resultingAppointment: true },
        });
        return this.proposalView(saved);
      });
    } catch (error) {
      this.bookingFailure(error);
    }
  }

  async doctorProposals(idAppointment: number, idUser: number, query: PaginationQueryDto) {
    const doctor = await this.schedules.ownDoctor(this.dataSource.manager, idUser);
    const appointment = await this.dataSource
      .getRepository(Appointment)
      .findOneBy({ idAppointment, doctor: { idDoctor: doctor.idDoctor } });
    if (!appointment) throw new NotFoundException('Cita propia no encontrada');
    return this.listProposals(
      idAppointment,
      query,
      'appointment.id_doctor = :owner',
      doctor.idDoctor,
    );
  }

  private async reschedulingAppointment(idAppointment: number, idUser: number) {
    const doctor = await this.schedules.ownDoctor(this.dataSource.manager, idUser);
    const appointment = await this.dataSource.getRepository(Appointment).findOne({
      where: {
        idAppointment,
        doctor: { idDoctor: doctor.idDoctor },
        isActive: true,
        deletedAt: IsNull(),
      },
      withDeleted: true,
      relations: { doctor: true, specialty: true },
    });
    if (!appointment) throw new NotFoundException('Cita propia no encontrada');
    if (appointment.status !== AppointmentStatus.CANCELLED)
      throw new ConflictException('Solo se puede proponer reprogramación para una cita cancelada');
    return appointment;
  }

  async reschedulingAvailability(
    idAppointment: number,
    idUser: number,
    query: ReschedulingAvailabilityQueryDto,
  ) {
    const appointment = await this.reschedulingAppointment(idAppointment, idUser);
    return this.schedules.availability({
      ...query,
      idDoctor: appointment.doctor.idDoctor,
      idSpecialty: appointment.specialty.idSpecialty,
    });
  }

  async proposeRescheduling(idAppointment: number, idUser: number, dto: CreateAppointmentDto) {
    const initial = await this.reschedulingAppointment(idAppointment, idUser);
    try {
      return await this.dataSource.transaction(async (manager) => {
        // Same serialization as booking, cancellation and schedule edits.
        await manager.getRepository(Doctor).findOne({
          where: { idDoctor: initial.doctor.idDoctor },
          lock: { mode: 'pessimistic_write' },
        });
        const doctor = await this.schedules.ownDoctor(manager, idUser);
        if (doctor.idDoctor !== initial.doctor.idDoctor)
          throw new ForbiddenException('El perfil médico ya no es válido para esta cita');
        const target = await manager.getRepository(Schedule).findOne({
          where: { idSchedule: dto.idSchedule, doctor: { idDoctor: doctor.idDoctor } },
          lock: { mode: 'pessimistic_write' },
        });
        if (!target || target.version !== dto.expectedVersion)
          throw new ConflictException('El horario cambió o ya no está disponible');
        const original = await manager
          .getRepository(Appointment)
          .createQueryBuilder('appointment')
          .where(
            'appointment.idAppointment = :idAppointment AND appointment.id_doctor = :idDoctor',
            { idAppointment, idDoctor: doctor.idDoctor },
          )
          .andWhere('appointment.isActive = true')
          .setLock('pessimistic_write')
          .getOne();
        if (!original) throw new NotFoundException('Cita propia no encontrada');
        if (original.status !== AppointmentStatus.CANCELLED)
          throw new ConflictException(
            'Solo se puede proponer reprogramación para una cita cancelada',
          );
        if (
          await manager
            .getRepository(ReschedulingProposal)
            .existsBy({ appointment: { idAppointment }, status: ProposalStatus.ACCEPTED })
        )
          throw new ConflictException('Esta cita ya fue reprogramada');
        const schedule = await this.schedules
          .availableQuery(manager)
          .andWhere('schedule.idSchedule = :idSchedule', { idSchedule: dto.idSchedule })
          .andWhere('doctor.idDoctor = :idDoctor AND specialty.idSpecialty = :idSpecialty', {
            idDoctor: doctor.idDoctor,
            idSpecialty: initial.specialty.idSpecialty,
          })
          .andWhere(
            '(schedule.date + schedule.startTime) > (clock_timestamp() AT TIME ZONE :timeZone)',
          )
          .getOne();
        if (!schedule)
          throw new ConflictException('El horario ya no está disponible para esta cita');
        const specialty = await manager.getRepository(Specialty).findOne({
          where: { idSpecialty: initial.specialty.idSpecialty, isActive: true },
          lock: { mode: 'pessimistic_read' },
        });
        if (!specialty) throw new ConflictException('La especialidad ya no está disponible');
        if (
          schedule.date === original.date &&
          schedule.startTime === original.startTime &&
          schedule.endTime === original.endTime
        )
          throw new ConflictException('Selecciona una fecha u horario diferente al original');
        // Persist the notification context atomically; proposals do not reserve the target block.
        const proposal = await manager.getRepository(ReschedulingProposal).save({
          appointment: original,
          schedule,
          scheduleVersion: schedule.version,
          originalDate: original.date,
          originalStartTime: original.startTime,
          originalEndTime: original.endTime,
          date: schedule.date,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          status: ProposalStatus.PENDING,
          createdBy: idUser,
        });
        return this.proposalView(proposal);
      });
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string; constraint?: string }).code === '23505' &&
        (error.driverError as { constraint?: string }).constraint ===
          'UQ_pending_proposal_appointment'
      )
        throw new ConflictException('Esta cita ya tiene una propuesta pendiente');
      throw error;
    }
  }

  private proposalView(proposal: ReschedulingProposal): PatientReschedulingProposal {
    return {
      idProposal: proposal.idProposal,
      originalDate: proposal.originalDate,
      originalStartTime: proposal.originalStartTime,
      originalEndTime: proposal.originalEndTime,
      date: proposal.date,
      startTime: proposal.startTime,
      endTime: proposal.endTime,
      status: proposal.status,
      respondedAt: proposal.respondedAt ?? null,
      resultingAppointmentId: proposal.resultingAppointment?.idAppointment ?? null,
      timeZone: 'America/La_Paz',
    };
  }

  async patientProposals(
    idAppointment: number,
    idUser: number,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<PatientReschedulingProposal>> {
    const original = await this.dataSource
      .getRepository(Appointment)
      .findOneBy({ idAppointment, patient: { idUser } });
    if (!original) throw new NotFoundException('Cita propia no encontrada');
    return this.listProposals(idAppointment, query, 'appointment.id_patient = :owner', idUser);
  }

  private async listProposals(
    idAppointment: number,
    query: PaginationQueryDto,
    scope: string,
    owner: number,
  ): Promise<PaginatedResult<PatientReschedulingProposal>> {
    const qb = this.dataSource
      .getRepository(ReschedulingProposal)
      .createQueryBuilder('proposal')
      .innerJoin('proposal.appointment', 'appointment')
      .leftJoinAndSelect('proposal.resultingAppointment', 'resultingAppointment')
      .where('appointment.idAppointment = :idAppointment', { idAppointment })
      .andWhere(scope, { owner })
      .orderBy('proposal.createdAt', 'DESC')
      .addOrderBy('proposal.idProposal', 'DESC');
    const page = await paginate(qb, query);
    return { ...page, data: page.data.map((proposal) => this.proposalView(proposal)) };
  }

  cancelMine(idAppointment: number, idUser: number) {
    return this.cancel(idAppointment, idUser);
  }

  cancelAsDoctor(idAppointment: number, idUser: number, reason: string) {
    if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 500)
      throw new BadRequestException('Indica un motivo de cancelación de entre 1 y 500 caracteres');
    return this.cancel(idAppointment, idUser, reason.trim());
  }

  private async cancel(idAppointment: number, idUser: number, reason?: string) {
    return this.dataSource.transaction(async (manager) => {
      const doctor =
        reason === undefined ? undefined : await this.schedules.ownDoctor(manager, idUser);
      const scope = doctor ? { doctor: { idDoctor: doctor.idDoctor } } : { patient: { idUser } };
      const ownerColumn = doctor ? 'id_doctor' : 'id_patient';
      const ownerId = doctor?.idDoctor ?? idUser;
      const scopeSql = `${ownerColumn} = :idUser`;

      const repository = manager.getRepository(Appointment);
      const initial = await repository.findOne({
        where: { idAppointment, ...scope, deletedAt: IsNull() },
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
      if (doctor && (await this.schedules.ownDoctor(manager, idUser)).idDoctor !== doctor.idDoctor)
        throw new ForbiddenException('El perfil médico ya no es válido para esta cita');
      const locked = await repository
        .createQueryBuilder('appointment')
        .where(`appointment.idAppointment = :idAppointment AND appointment.${scopeSql}`, {
          idAppointment,
          idUser: ownerId,
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
          // Durable integration context for EPIC-07, committed atomically with cancellation.
          cancellationReason: reason ?? null,
          cancellationSource: doctor ? 'DOCTOR' : 'PATIENT',
          updatedBy: idUser,
        })
        .where(`id_appointment = :idAppointment AND ${scopeSql}`, {
          idAppointment,
          idUser: ownerId,
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
        'appointment.cancellationReason',
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
        cancellationReason:
          appointment.status === AppointmentStatus.CANCELLED
            ? (appointment.cancellationReason ?? null)
            : null,
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
      return await this.dataSource.transaction((manager) =>
        this.reserveWithin(manager, dto, idPatient, actorId),
      );
    } catch (error) {
      this.bookingFailure(error);
    }
  }
  private bookingFailure(error: unknown): never {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === '23505'
    ) {
      const constraint = (error.driverError as { constraint?: string }).constraint;
      if (constraint === 'UQ_appointments_schedule')
        throw new ConflictException('El horario ya está reservado');
      if (constraint === 'UQ_accepted_proposal_appointment')
        throw new ConflictException('La cita ya fue reprogramada');
    }
    throw error;
  }

  private async reserveWithin(
    manager: EntityManager,
    dto: CreateAppointmentDto,
    idPatient: number,
    actorId: number,
  ) {
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
      .andWhere('(schedule.date + schedule.startTime) > (clock_timestamp() AT TIME ZONE :timeZone)')
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
  }
}
