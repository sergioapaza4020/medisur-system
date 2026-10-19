import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Appointment } from 'src/entities/appointments/appointment.entity';
import { ReschedulingProposal } from 'src/entities/appointments/rescheduling-proposal.entity';
import { Doctor } from 'src/entities/doctors/doctors.entity';
import { Schedule } from 'src/entities/schedules/schedule.entity';
import { Specialty } from 'src/entities/specialties/specialties.entity';
import { User } from 'src/entities/users/users.entity';
import { SchedulesService } from '../schedules/schedules.service';
import { AppointmentsService } from './appointments.service';

const chain = () =>
  Object.fromEntries(
    ['where', 'andWhere', 'setLock', 'withDeleted', 'leftJoinAndSelect', 'innerJoin'].map(
      (name) => [name, jest.fn().mockReturnThis()],
    ),
  );
describe('Patient rescheduling response transaction', () => {
  let service: AppointmentsService;
  let initial: jest.Mock;
  let update: jest.Mock;
  let save: jest.Mock;
  let available: Record<string, jest.Mock>;
  let pending: Record<string, jest.Mock>;
  let original: Record<string, jest.Mock>;
  let target: Record<string, jest.Mock>;
  let locks: string[];
  const time = new Date('2026-10-19T12:00:00Z');
  const originalData = {
    idAppointment: 9,
    status: 'CANCELLED',
    date: '2099-11-02',
    doctor: { idDoctor: 3 },
    specialty: { idSpecialty: 4 },
  };
  const targetData = {
    idSchedule: 5,
    version: 2,
    date: '2099-11-03',
    startTime: '11:00:00',
    endTime: '12:00:00',
    doctor: { idDoctor: 3 },
    specialty: { idSpecialty: 4 },
  };
  beforeEach(() => {
    locks = [];
    const proposal = {
      idProposal: 1,
      status: 'PENDING',
      scheduleVersion: 2,
      date: targetData.date,
      startTime: targetData.startTime,
      endTime: targetData.endTime,
    };
    initial = jest
      .fn()
      .mockResolvedValue({ ...proposal, appointment: originalData, schedule: targetData });
    target = {
      ...chain(),
      getOne: jest.fn(() => {
        locks.push('schedule');
        return Promise.resolve(targetData);
      }),
    };
    original = {
      ...chain(),
      getOne: jest.fn(() => {
        locks.push('appointment');
        return Promise.resolve(originalData);
      }),
    };
    pending = {
      ...chain(),
      getOne: jest.fn(() => {
        locks.push('proposal');
        return Promise.resolve(proposal);
      }),
    };
    available = { ...chain(), getOne: jest.fn().mockResolvedValue(targetData) };
    save = jest.fn().mockResolvedValue({ idAppointment: 20, ...targetData, status: 'RESERVED' });
    update = jest.fn().mockResolvedValue({ affected: 1 });
    const proposalRepository = {
      findOne: initial,
      createQueryBuilder: () => pending,
      existsBy: jest.fn().mockResolvedValue(false),
      update,
      findOneOrFail: jest.fn().mockResolvedValue({
        ...proposal,
        status: 'ACCEPTED',
        respondedAt: time,
        resultingAppointment: { idAppointment: 20 },
      }),
    };
    const manager = {
      getRepository: (entity: unknown) => {
        if (entity === ReschedulingProposal) return proposalRepository;
        if (entity === Appointment) return { createQueryBuilder: () => original, save };
        if (entity === Doctor)
          return {
            findOne: jest.fn(() => {
              locks.push('doctor');
              return Promise.resolve({ idDoctor: 3 });
            }),
          };
        if (entity === Schedule)
          return {
            createQueryBuilder: () => target,
            findOne: jest.fn().mockResolvedValue(targetData),
          };
        if (entity === Specialty)
          return { findOne: jest.fn().mockResolvedValue({ idSpecialty: 4 }) };
        if (entity === User)
          return {
            createQueryBuilder: () => ({
              ...chain(),
              getOne: jest.fn().mockResolvedValue({ idUser: 7 }),
            }),
          };
        throw new Error('Unexpected repository');
      },
    };
    service = new AppointmentsService(
      {
        transaction: (callback: (manager: unknown) => unknown) => callback(manager),
      } as unknown as DataSource,
      { availableQuery: () => available } as unknown as SchedulesService,
    );
  });
  it('checks authenticated ownership before any locks or writes', async () => {
    initial.mockResolvedValue(null);
    await expect(service.respondRescheduling(1, 8, 'ACCEPTED')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(initial).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          appointment: expect.objectContaining({ patient: { idUser: 8 } }) as unknown,
        }) as unknown,
      }),
    );
    expect(locks).toEqual([]);
    expect(save).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
  it('locks in the shared order, reuses booking and records decision and audit together', async () => {
    expect(await service.respondRescheduling(1, 7, 'ACCEPTED')).toMatchObject({
      status: 'ACCEPTED',
      resultingAppointmentId: 20,
      respondedAt: time,
    });
    expect(locks.slice(0, 4)).toEqual(['doctor', 'schedule', 'appointment', 'proposal']);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        patient: { idUser: 7 },
        date: targetData.date,
        status: 'RESERVED',
        createdBy: 7,
      }),
    );
    expect(update).toHaveBeenCalledWith(
      { idProposal: 1, status: 'PENDING' },
      expect.objectContaining({
        status: 'ACCEPTED',
        respondedBy: 7,
        updatedBy: 7,
        resultingAppointment: { idAppointment: 20 },
      }),
    );
  });
  it('rejects without querying availability or creating a reservation', async () => {
    await service.respondRescheduling(1, 7, 'REJECTED');
    expect(locks).toEqual(['doctor', 'appointment', 'proposal']);
    expect(available.getOne).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      { idProposal: 1, status: 'PENDING' },
      expect.objectContaining({ status: 'REJECTED', resultingAppointment: null }),
    );
  });
  it.each(['ACCEPTED', 'REJECTED'])(
    'rejects a previously responded proposal %s',
    async (status) => {
      pending.getOne.mockResolvedValue({ status });
      await expect(service.respondRescheduling(1, 7, 'REJECTED')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(update).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
    },
  );
  it('does not accept edited snapshots or unavailable blocks', async () => {
    target.getOne.mockResolvedValueOnce({ ...targetData, version: 3 });
    await expect(service.respondRescheduling(1, 7, 'ACCEPTED')).rejects.toBeInstanceOf(
      ConflictException,
    );
    available.getOne.mockResolvedValue(null);
    await expect(service.respondRescheduling(1, 7, 'ACCEPTED')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(save).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
  it('rejects incompatible source state after obtaining its lock', async () => {
    original.getOne.mockResolvedValue({ ...originalData, status: 'RESERVED' });
    await expect(service.respondRescheduling(1, 7, 'ACCEPTED')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(save).not.toHaveBeenCalled();
  });
  it('rejects invalid decisions even when called without the HTTP DTO', async () => {
    await expect(service.respondRescheduling(1, 7, 'PENDING' as 'ACCEPTED')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(initial).not.toHaveBeenCalled();
  });
});
