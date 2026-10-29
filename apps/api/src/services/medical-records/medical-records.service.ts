import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { PaginationQueryDto } from 'src/dtos/common/pagination-query.dto';
import { PaginatedResult } from '@common/types/pagination.type';
import { DoctorMedicalEncounter } from '@common/types/doctor-medical-record.type';
import { PatientMedicalEncounter } from '@common/types/patient-medical-record.type';
import { paginate } from '@common/utils/paginate';
import { Appointment, AppointmentStatus } from 'src/entities/appointments/appointment.entity';
import { Doctor } from 'src/entities/doctors/doctors.entity';
import { Encounter } from 'src/entities/encounters/encounter.entity';
import { MedicalRecord } from 'src/entities/medical-records/medical-record.entity';
import { MedicalRecordAccess } from 'src/entities/medical-records/medical-record-access.entity';
import { User } from 'src/entities/users/users.entity';
import { SchedulesService } from '../schedules/schedules.service';

@Injectable()
export class MedicalRecordsService {
  constructor(
    private readonly source: DataSource,
    private readonly schedules: SchedulesService,
  ) {}

  async mine(
    idUser: number,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<PatientMedicalEncounter>> {
    return this.source.transaction(async (manager) => {
      const patient = await manager.getRepository(User).findOne({
        where: { idUser, isActive: true },
        select: ['idUser'],
        lock: { mode: 'pessimistic_read' },
      });
      if (!patient) throw new ForbiddenException('No puedes consultar este historial');
      const record = await this.activeRecord(manager, idUser);
      const result = await this.encounterPage(manager, idUser, record, query);
      return {
        ...result,
        data: result.data.map(({ occurredAt, summary, doctor, specialty }) => ({
          occurredAt,
          summary,
          doctor,
          specialty,
        })),
      };
    });
  }

  async byAppointment(
    idAppointment: number,
    idUser: number,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<DoctorMedicalEncounter>> {
    return this.source.transaction(async (manager) => {
      const doctor = await this.schedules.ownDoctor(manager, idUser);
      await manager
        .getRepository(Doctor)
        .findOne({ where: { idDoctor: doctor.idDoctor }, lock: { mode: 'pessimistic_read' } });
      await this.schedules.ownDoctor(manager, idUser);
      const appointment = await manager
        .getRepository(Appointment)
        .createQueryBuilder('appointment')
        .innerJoinAndSelect('appointment.patient', 'patient')
        .select(['appointment.idAppointment', 'patient.idUser'])
        .where('appointment.idAppointment = :idAppointment', { idAppointment })
        .andWhere('appointment.id_doctor = :idDoctor', { idDoctor: doctor.idDoctor })
        .andWhere('appointment.status = :status AND appointment.isActive = true', {
          status: AppointmentStatus.RESERVED,
        })
        .andWhere('patient.isActive = true')
        .setLock('pessimistic_read', undefined, ['appointment', 'patient'])
        .getOne();
      if (!appointment)
        throw new ForbiddenException('No tienes una cita válida para consultar este historial');
      const record = await this.activeRecord(manager, appointment.patient.idUser);
      const result = await this.encounterPage(manager, appointment.patient.idUser, record, query);
      // Fail closed: an access must leave durable context before any clinical response is returned.
      const accesses = manager.getRepository(MedicalRecordAccess);
      await accesses.save(
        accesses.create({
          actor: { idUser },
          patient: appointment.patient,
          doctor,
          appointment,
          medicalRecord: record,
        }),
      );
      return result;
    });
  }

  private async activeRecord(manager: EntityManager, idPatient: number) {
    const record = await manager.getRepository(MedicalRecord).findOne({
      where: { idPatient },
      withDeleted: true,
      lock: { mode: 'pessimistic_read' },
    });
    if (record && (!record.isActive || record.deletedAt))
      throw new ForbiddenException('Historial no disponible para consulta');
    return record;
  }

  private async encounterPage(
    manager: EntityManager,
    idPatient: number,
    record: MedicalRecord | null,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<DoctorMedicalEncounter>> {
    const qb = manager
      .getRepository(Encounter)
      .createQueryBuilder('encounter')
      .withDeleted()
      .innerJoin('encounter.medicalRecord', 'record')
      .leftJoinAndSelect('encounter.doctor', 'doctor')
      .leftJoinAndSelect('doctor.user', 'author')
      .leftJoinAndSelect('encounter.specialty', 'specialty')
      .select([
        'encounter.idEncounter',
        'encounter.occurredAt',
        'encounter.summary',
        'doctor.idDoctor',
        'author.idUser',
        'author.name',
        'author.lastname',
        'specialty.idSpecialty',
        'specialty.name',
      ])
      .where('record.idMedicalRecord = :recordId AND record.idPatient = :patientId', {
        recordId: record?.idMedicalRecord ?? 0,
        patientId: idPatient,
      })
      .andWhere('record.isActive = true AND record.deletedAt IS NULL')
      .andWhere('encounter.isActive = true AND encounter.deletedAt IS NULL')
      .orderBy('encounter.occurredAt', 'DESC')
      .addOrderBy('encounter.idEncounter', 'DESC');
    const result = await paginate(qb, query);
    return {
      ...result,
      data: result.data.map((encounter) => ({
        idEncounter: encounter.idEncounter,
        occurredAt: encounter.occurredAt,
        summary: encounter.summary,
        doctor: {
          name: encounter.doctor?.user?.name ?? 'Médico',
          lastname: encounter.doctor?.user?.lastname ?? '',
        },
        specialty: { name: encounter.specialty?.name ?? 'Especialidad' },
      })),
    };
  }
}
