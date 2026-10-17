import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Doctor } from 'src/entities/doctors/doctors.entity';
import { Specialty } from 'src/entities/specialties/specialties.entity';
import { SchedulesService } from './schedules.service';

describe('Schedule registration', () => {
  const doctor = { idDoctor: 3 };
  const dto = { idSpecialty: 2, date: '2026-11-02', startTime: '09:00', endTime: '10:00' };
  let service: SchedulesService;
  let doctors: { findOne: jest.Mock };
  let specialties: { findOne: jest.Mock };
  let schedules: { createQueryBuilder: jest.Mock; create: jest.Mock; save: jest.Mock };
  let qb: { where: jest.Mock; andWhere: jest.Mock; getExists: jest.Mock };
  beforeEach(() => {
    doctors = { findOne: jest.fn().mockResolvedValue(doctor) };
    specialties = { findOne: jest.fn().mockResolvedValue({ idSpecialty: 2 }) };
    qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getExists: jest.fn().mockResolvedValue(false),
    };
    schedules = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      create: jest.fn((value: unknown) => value),
      save: jest.fn((value: object) => ({ ...value, idSchedule: 1, isActive: true })),
    };
    const manager = {
      getRepository: (entity: unknown) =>
        entity === Doctor ? doctors : entity === Specialty ? specialties : schedules,
    };
    service = new SchedulesService({
      transaction: (callback: (m: unknown) => unknown) => callback(manager),
    } as unknown as DataSource);
  });
  it('uses the session identity and stores only the selected doctor and specialty', async () => {
    await expect(service.create(dto, 7)).resolves.toMatchObject({
      idDoctor: 3,
      idSpecialty: 2,
      idSchedule: 1,
    });
    expect(doctors.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user: expect.objectContaining({ idUser: 7 }) as unknown,
        }) as unknown,
      }),
    );
    expect(doctors.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
  });
  it.each([
    ['10:00', '10:00'],
    ['11:00', '10:00'],
  ])('rejects invalid interval %s - %s', async (startTime, endTime) => {
    await expect(service.create({ ...dto, startTime, endTime }, 7)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(schedules.save).not.toHaveBeenCalled();
  });
  it('rejects overlaps across all specialties', async () => {
    qb.getExists.mockResolvedValue(true);
    await expect(service.create(dto, 7)).rejects.toThrow('solapa');
    expect(qb.andWhere).toHaveBeenCalledWith(
      'schedule.startTime < :end AND schedule.endTime > :start',
      { start: '09:00', end: '10:00' },
    );
    expect(schedules.save).not.toHaveBeenCalled();
  });
  it('rejects missing or inactive own doctor', async () => {
    doctors.findOne.mockResolvedValue(null);
    await expect(service.create(dto, 7)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('rejects an inactive specialty', async () => {
    specialties.findOne.mockResolvedValue(null);
    await expect(service.create(dto, 7)).rejects.toThrow('especialidad activa');
  });
  it('rejects unassigned specialty', async () => {
    doctors.findOne
      .mockResolvedValueOnce(doctor)
      .mockResolvedValueOnce(doctor)
      .mockResolvedValueOnce(doctor)
      .mockResolvedValueOnce(null);
    await expect(service.create(dto, 7)).rejects.toThrow('especialidad activa');
  });
});
