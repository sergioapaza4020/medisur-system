import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Doctor } from 'src/entities/doctors/doctors.entity';
import { Specialty } from 'src/entities/specialties/specialties.entity';
import { ScheduleHistory } from 'src/entities/schedules/schedule-history.entity';
import { SchedulesService } from './schedules.service';

describe('Schedule changes and traceability', () => {
  const doctor = { idDoctor: 3 };
  const specialty = { idSpecialty: 2, name: 'Cardiología' };
  const current = {
    idSchedule: 9,
    doctor,
    specialty,
    date: '2026-11-02',
    startTime: '09:00:00',
    endTime: '10:00:00',
    isActive: true,
    version: 1,
  };
  const dto = {
    idSpecialty: 2,
    date: current.date,
    startTime: '10:00',
    endTime: '11:00',
    isActive: true,
    expectedVersion: 1,
  };
  let service: SchedulesService;
  let doctors: { findOne: jest.Mock };
  let specialties: { findOne: jest.Mock };
  let schedules: { findOne: jest.Mock; save: jest.Mock; createQueryBuilder: jest.Mock };
  let history: { save: jest.Mock };
  let qb: {
    where: jest.Mock;
    andWhere: jest.Mock;
    getExists: jest.Mock;
    getOne: jest.Mock;
    setLock: jest.Mock;
  };
  let query: jest.Mock;
  beforeEach(() => {
    doctors = { findOne: jest.fn().mockResolvedValue(doctor) };
    specialties = { findOne: jest.fn().mockResolvedValue(specialty) };
    qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getExists: jest.fn().mockResolvedValue(false),
      getOne: jest.fn().mockResolvedValue({ ...current }),
      setLock: jest.fn().mockReturnThis(),
    };
    schedules = {
      findOne: jest.fn().mockResolvedValue({ ...current }),
      save: jest.fn((value: object) => Promise.resolve(value)),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    history = { save: jest.fn().mockResolvedValue({}) };
    query = jest.fn().mockResolvedValue([{ present: false }]);
    const manager = {
      query,
      getRepository: (entity: unknown) =>
        entity === Doctor
          ? doctors
          : entity === Specialty
            ? specialties
            : entity === ScheduleHistory
              ? history
              : schedules,
    };
    service = new SchedulesService({
      transaction: (callback: (manager: unknown) => unknown) => callback(manager),
    } as unknown as DataSource);
  });
  it('keeps the identifier, increments version and saves before/after with the session author in the transaction', async () => {
    await expect(service.update(9, dto, 7)).resolves.toMatchObject({
      idSchedule: 9,
      idDoctor: 3,
      startTime: '10:00',
      version: 2,
    });
    expect(history.save).toHaveBeenCalledWith(
      expect.objectContaining({
        createdBy: 7,
        before: {
          idSpecialty: 2,
          date: current.date,
          startTime: '09:00',
          endTime: '10:00',
          isActive: true,
          version: 1,
        },
        after: {
          idSpecialty: 2,
          date: current.date,
          startTime: '10:00',
          endTime: '11:00',
          isActive: true,
          version: 2,
        },
      }),
    );
    expect(qb.andWhere).toHaveBeenCalledWith('schedule.id_doctor = :idDoctor', { idDoctor: 3 });
    expect(qb.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(schedules.save).toHaveBeenCalledWith(
      expect.objectContaining({ idSchedule: 9, updatedBy: 7 }),
    );
    expect(qb.andWhere).toHaveBeenCalledWith('schedule.idSchedule <> :exceptId', { exceptId: 9 });
  });
  it('rejects another doctor schedule without writing', async () => {
    qb.getOne.mockResolvedValueOnce(null);
    await expect(service.update(99, dto, 7)).rejects.toBeInstanceOf(NotFoundException);
    expect(schedules.save).not.toHaveBeenCalled();
    expect(history.save).not.toHaveBeenCalled();
  });
  it('rejects inactive own profile', async () => {
    doctors.findOne.mockResolvedValueOnce(null);
    await expect(service.update(9, dto, 7)).rejects.toBeInstanceOf(ForbiddenException);
    expect(schedules.save).not.toHaveBeenCalled();
  });
  it('rejects stale versions without overwriting another edit', async () => {
    await expect(service.update(9, { ...dto, expectedVersion: 2 }, 7)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(schedules.save).not.toHaveBeenCalled();
  });
  it.each([
    ['10:00', '10:00'],
    ['11:00', '10:00'],
  ])('rejects invalid time interval %s - %s', async (startTime, endTime) => {
    await expect(service.update(9, { ...dto, startTime, endTime }, 7)).rejects.toThrow('anterior');
    expect(schedules.save).not.toHaveBeenCalled();
  });
  it('rejects overlaps without inserting history', async () => {
    qb.getExists.mockResolvedValue(true);
    await expect(service.update(9, dto, 7)).rejects.toThrow('solapa');
    expect(schedules.save).not.toHaveBeenCalled();
    expect(history.save).not.toHaveBeenCalled();
  });
  it('allows deactivation retaining an inactive specialty and preserving all historical values', async () => {
    specialties.findOne.mockResolvedValue(null);
    await expect(
      service.update(9, { ...dto, startTime: '09:00', endTime: '10:00', isActive: false }, 7),
    ).resolves.toMatchObject({ isActive: false, version: 2 });
    expect(specialties.findOne).not.toHaveBeenCalled();
    expect(qb.getExists).not.toHaveBeenCalled();
    expect(history.save).toHaveBeenCalledTimes(1);
  });
  it('validates overlaps when reactivating an inactive block', async () => {
    schedules.findOne.mockResolvedValue({ ...current, isActive: false });
    qb.getExists.mockResolvedValue(true);
    await expect(service.update(9, dto, 7)).rejects.toThrow('solapa');
  });
  it('rejects inactive or unassigned specialties for new configurations', async () => {
    specialties.findOne.mockResolvedValue(null);
    await expect(service.update(9, dto, 7)).rejects.toThrow('especialidad activa');
    expect(schedules.save).not.toHaveBeenCalled();
  });
  it('does not create artificial revisions for an unchanged request', async () => {
    await expect(
      service.update(9, { ...dto, startTime: '09:00', endTime: '10:00' }, 7),
    ).resolves.toMatchObject({ version: 1 });
    expect(schedules.save).not.toHaveBeenCalled();
    expect(history.save).not.toHaveBeenCalled();
  });
  it.each([{ rows: [{ present: true }] }, { rows: [] }])(
    'fails closed when appointments exist or the policy result is unknown',
    async ({ rows }) => {
      query.mockResolvedValue(rows);
      await expect(service.update(9, dto, 7)).rejects.toBeInstanceOf(ConflictException);
      expect(schedules.save).not.toHaveBeenCalled();
    },
  );
  it('propagates history failure to roll back the same transaction', async () => {
    history.save.mockRejectedValue(new Error('History unavailable'));
    await expect(service.update(9, dto, 7)).rejects.toThrow('History unavailable');
  });
});
