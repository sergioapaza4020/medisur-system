import { DataSource, EntityManager } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';
import { MedicalRecordsService } from './medical-records.service';
import { SchedulesService } from '../schedules/schedules.service';
import { MedicalRecordAccess } from 'src/entities/medical-records/medical-record-access.entity';
import { MedicalRecord } from 'src/entities/medical-records/medical-record.entity';
import { Encounter } from 'src/entities/encounters/encounter.entity';
import { Appointment } from 'src/entities/appointments/appointment.entity';
import { Schedule } from 'src/entities/schedules/schedule.entity';
import { Doctor } from 'src/entities/doctors/doctors.entity';
import { User } from 'src/entities/users/users.entity';
import { Specialty } from 'src/entities/specialties/specialties.entity';
import { Role } from 'src/entities/roles/roles.entity';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { PaginationQueryDto } from 'src/dtos/common/pagination-query.dto';

class QuerySource extends DataSource {
  prepare() {
    return this.buildMetadatas();
  }
}
describe('Doctor medical record authorization and projection', () => {
  const source = new QuerySource({
    type: 'postgres',
    entities: [
      MedicalRecordAccess,
      MedicalRecord,
      Encounter,
      Appointment,
      Schedule,
      Doctor,
      User,
      Specialty,
      Role,
      Permission,
      UserSession,
    ],
  });
  const schedules = new SchedulesService(source);
  const transaction = jest.fn((callback: (manager: EntityManager) => Promise<unknown>) =>
    callback(source.manager),
  );
  const service = new MedicalRecordsService({ transaction } as unknown as DataSource, schedules);
  let appointmentQuery: ReturnType<typeof source.createQueryBuilder<Appointment>>;
  let clinicalQuery: ReturnType<typeof source.createQueryBuilder<Encounter>>;
  let saveAccess: jest.SpyInstance;
  let doctorLookup: jest.SpyInstance;
  let appointmentLookup: jest.SpyInstance;
  let recordLookup: jest.SpyInstance;
  let encounterLookup: jest.SpyInstance;
  let patientLookup: jest.SpyInstance;
  const appointment = { idAppointment: 9, patient: { idUser: 5 } } as Appointment;
  const record = {
    idMedicalRecord: 4,
    idPatient: 5,
    isActive: true,
    deletedAt: null,
  } as MedicalRecord;
  const page = Object.assign(new PaginationQueryDto(), { page: 2, limit: 5 });
  beforeAll(async () => source.prepare());
  beforeEach(() => {
    patientLookup = jest
      .spyOn(source.getRepository(User), 'findOne')
      .mockResolvedValue({ idUser: 5 } as User);
    doctorLookup = jest.spyOn(schedules, 'ownDoctor').mockResolvedValue({ idDoctor: 3 } as Doctor);
    jest
      .spyOn(source.getRepository(Doctor), 'findOne')
      .mockResolvedValue({ idDoctor: 3 } as Doctor);
    const appointments = source.getRepository(Appointment);
    appointmentQuery = appointments.createQueryBuilder('appointment');
    jest.spyOn(appointments, 'createQueryBuilder').mockReturnValue(appointmentQuery);
    appointmentLookup = jest.spyOn(appointmentQuery, 'getOne').mockResolvedValue(appointment);
    recordLookup = jest
      .spyOn(source.getRepository(MedicalRecord), 'findOne')
      .mockResolvedValue(record);
    const encounters = source.getRepository(Encounter);
    clinicalQuery = encounters.createQueryBuilder('encounter');
    jest.spyOn(encounters, 'createQueryBuilder').mockReturnValue(clinicalQuery);
    encounterLookup = jest.spyOn(clinicalQuery, 'getManyAndCount').mockResolvedValue([
      [
        {
          idEncounter: 11,
          occurredAt: new Date('2026-10-01T13:00:00Z'),
          summary: 'Clinical summary',
          doctor: {
            idDoctor: 99,
            user: {
              idUser: 99,
              name: 'Ana',
              lastname: 'Pérez',
              email: 'private',
              password: 'private',
            },
          },
          specialty: { idSpecialty: 8, name: 'General' },
          createdBy: 99,
        } as Encounter,
      ],
      12,
    ]);
    saveAccess = jest
      .spyOn(source.getRepository(MedicalRecordAccess), 'save')
      .mockResolvedValue({ idAccess: 1 } as MedicalRecordAccess);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    transaction.mockClear();
  });
  it('authorizes by own reserved appointment and active patient before reading clinical data', async () => {
    await service.byAppointment(9, 7, page);
    expect(appointmentQuery.getParameters()).toMatchObject({
      idAppointment: 9,
      idDoctor: 3,
      status: 'RESERVED',
    });
    const sql = appointmentQuery.getQuery();
    for (const field of ['id_doctor', 'is_active', 'deleted_at']) expect(sql).toContain(field);
    expect(appointmentQuery.expressionMap.lockTables).toEqual(['appointment', 'patient']);
    expect(doctorLookup).toHaveBeenCalledWith(source.manager, 7);
  });
  it('uses shared pagination, stable ordering, patient and record predicates and a minimal projection', async () => {
    const result = await service.byAppointment(9, 7, page);
    expect(result.meta).toEqual({ page: 2, limit: 5, total: 12, totalPages: 3 });
    expect(result.data[0]).toEqual({
      idEncounter: 11,
      occurredAt: new Date('2026-10-01T13:00:00Z'),
      summary: 'Clinical summary',
      doctor: { name: 'Ana', lastname: 'Pérez' },
      specialty: { name: 'General' },
    });
    expect(clinicalQuery.getParameters()).toMatchObject({ recordId: 4, patientId: 5 });
    expect(clinicalQuery.expressionMap.skip).toBe(5);
    expect(clinicalQuery.expressionMap.take).toBe(5);
    expect(clinicalQuery.expressionMap.orderBys).toEqual({
      'encounter.occurredAt': 'DESC',
      'encounter.idEncounter': 'DESC',
    });
    expect(clinicalQuery.getQuery()).not.toMatch(/password|email|created_by|cancelled/);
    expect(JSON.stringify(result)).not.toMatch(
      /idPatient|idDoctor|idUser|createdBy|email|password/,
    );
  });
  it('persists minimal access context without clinical text and fails if it cannot be saved', async () => {
    await service.byAppointment(9, 7, page);
    expect(saveAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { idUser: 7 },
        patient: appointment.patient,
        doctor: { idDoctor: 3 },
        appointment,
        medicalRecord: record,
      }),
    );
    expect(JSON.stringify(saveAccess.mock.calls)).not.toMatch(
      /Clinical summary|summary|password|email/,
    );
    saveAccess.mockRejectedValueOnce(new Error('audit failure'));
    await expect(service.byAppointment(9, 7, page)).rejects.toThrow('audit failure');
  });
  it('rejects a missing or foreign or invalid appointment before querying encounters', async () => {
    appointmentLookup.mockResolvedValue(null);
    await expect(service.byAppointment(999, 7, page)).rejects.toBeInstanceOf(ForbiddenException);
    expect(encounterLookup).not.toHaveBeenCalled();
    expect(saveAccess).not.toHaveBeenCalled();
  });
  it('rejects a missing active medical profile', async () => {
    doctorLookup.mockRejectedValue(new ForbiddenException());
    await expect(service.byAppointment(9, 7, page)).rejects.toBeInstanceOf(ForbiddenException);
    expect(appointmentLookup).not.toHaveBeenCalled();
    expect(saveAccess).not.toHaveBeenCalled();
  });
  it.each([{ isActive: false }, { deletedAt: new Date() }])(
    'rejects unavailable histories %j',
    async (state) => {
      recordLookup.mockResolvedValue({ ...record, ...state });
      await expect(service.byAppointment(9, 7, page)).rejects.toBeInstanceOf(ForbiddenException);
      expect(encounterLookup).not.toHaveBeenCalled();
      expect(saveAccess).not.toHaveBeenCalled();
    },
  );
  it('returns a valid empty page without creating a history when none exists', async () => {
    recordLookup.mockResolvedValue(null);
    encounterLookup.mockResolvedValue([[], 0]);
    expect(await service.byAppointment(9, 7, new PaginationQueryDto())).toEqual({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
    expect(clinicalQuery.getParameters()).toMatchObject({ recordId: 0, patientId: 5 });
    expect(saveAccess).toHaveBeenCalledWith(expect.objectContaining({ medicalRecord: null }));
  });

  it('scopes the patient history to the session account and omits all internal identifiers', async () => {
    const result = await service.mine(5, page);
    expect(patientLookup).toHaveBeenCalledWith({
      where: { idUser: 5, isActive: true },
      select: ['idUser'],
      lock: { mode: 'pessimistic_read' },
    });
    expect(recordLookup).toHaveBeenCalledWith(expect.objectContaining({ where: { idPatient: 5 } }));
    expect(clinicalQuery.getParameters()).toMatchObject({ recordId: 4, patientId: 5 });
    expect(result.data[0]).toEqual({
      occurredAt: new Date('2026-10-01T13:00:00Z'),
      summary: 'Clinical summary',
      doctor: { name: 'Ana', lastname: 'Pérez' },
      specialty: { name: 'General' },
    });
    expect(result.meta).toEqual({ page: 2, limit: 5, total: 12, totalPages: 3 });
    expect(JSON.stringify(result)).not.toMatch(
      /idEncounter|idPatient|idDoctor|idUser|createdBy|password|email/,
    );
    expect(doctorLookup).not.toHaveBeenCalled();
    expect(appointmentLookup).not.toHaveBeenCalled();
    expect(saveAccess).not.toHaveBeenCalled();
  });

  it('rejects missing or inactive patient accounts before reading a record', async () => {
    patientLookup.mockResolvedValue(null);
    await expect(service.mine(5, page)).rejects.toBeInstanceOf(ForbiddenException);
    expect(recordLookup).not.toHaveBeenCalled();
    expect(encounterLookup).not.toHaveBeenCalled();
  });

  it('returns an empty patient history without creating records', async () => {
    recordLookup.mockResolvedValue(null);
    encounterLookup.mockResolvedValue([[], 0]);
    expect(await service.mine(5, new PaginationQueryDto())).toEqual({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
    expect(clinicalQuery.getParameters()).toMatchObject({ recordId: 0, patientId: 5 });
    expect(saveAccess).not.toHaveBeenCalled();
  });

  it.each([{ isActive: false }, { deletedAt: new Date() }])(
    'denies unavailable patient histories %j',
    async (state) => {
      recordLookup.mockResolvedValue({ ...record, ...state });
      await expect(service.mine(5, page)).rejects.toBeInstanceOf(ForbiddenException);
      expect(encounterLookup).not.toHaveBeenCalled();
    },
  );
});
