import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Appointment } from 'src/entities/appointments/appointment.entity';
import { Doctor } from 'src/entities/doctors/doctors.entity';
import { Schedule } from 'src/entities/schedules/schedule.entity';
import { Specialty } from 'src/entities/specialties/specialties.entity';
import { ReschedulingProposal } from 'src/entities/appointments/rescheduling-proposal.entity';
import { SchedulesService } from '../schedules/schedules.service';
import { AppointmentsService } from './appointments.service';

const chain = () =>
  Object.fromEntries(
    ['where', 'andWhere', 'setLock'].map((name) => [name, jest.fn().mockReturnThis()]),
  );
describe('Rescheduling proposal rules', () => {
  let service: AppointmentsService;
  let original: {
    idAppointment: number;
    doctor: { idDoctor: number };
    specialty: { idSpecialty: number };
    status: string;
    date: string;
    startTime: string;
    endTime: string;
  };
  let findOriginal: jest.Mock;
  let ownDoctor: jest.Mock;
  let save: jest.Mock;
  let availability: jest.Mock;
  let available: Record<string, jest.Mock>;
  let lockedOriginal: Record<string, jest.Mock>;
  let target: jest.Mock;
  let transaction: jest.Mock;
  const dto = { idSchedule: 5, expectedVersion: 2 };
  beforeEach(() => {
    original = {
      idAppointment: 9,
      doctor: { idDoctor: 3 },
      specialty: { idSpecialty: 4 },
      status: 'CANCELLED',
      date: '2099-11-02',
      startTime: '09:00:00',
      endTime: '10:00:00',
    };
    findOriginal = jest.fn().mockResolvedValue(original);
    ownDoctor = jest.fn().mockResolvedValue({ idDoctor: 3 });
    availability = jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } });
    target = jest.fn().mockResolvedValue({ idSchedule: 5, version: 2 });
    save = jest.fn((data: Record<string, unknown>) => Promise.resolve({ ...data, idProposal: 1 }));
    available = {
      ...chain(),
      getOne: jest.fn().mockResolvedValue({
        idSchedule: 5,
        version: 2,
        date: '2099-11-03',
        startTime: '11:00:00',
        endTime: '12:00:00',
      }),
    };
    lockedOriginal = { ...chain(), getOne: jest.fn().mockResolvedValue(original) };
    const manager = {
      getRepository: (entity: unknown) => {
        if (entity === Doctor) return { findOne: jest.fn().mockResolvedValue({ idDoctor: 3 }) };
        if (entity === Schedule) return { findOne: target };
        if (entity === Specialty)
          return { findOne: jest.fn().mockResolvedValue({ idSpecialty: 4 }) };
        if (entity === Appointment) return { createQueryBuilder: () => lockedOriginal };
        if (entity === ReschedulingProposal) return { save };
        throw new Error('Unexpected repository');
      },
    };
    transaction = jest.fn((callback: (manager: unknown) => unknown) => callback(manager));
    service = new AppointmentsService(
      {
        manager: {},
        getRepository: () => ({ findOne: findOriginal, findOneBy: findOriginal }),
        transaction,
      } as unknown as DataSource,
      { ownDoctor, availability, availableQuery: () => available } as unknown as SchedulesService,
    );
  });
  it('reuses availability with server-resolved doctor and specialty', async () => {
    await service.reschedulingAvailability(9, 7, { page: 2, limit: 5, date: '2099-11-03' });
    expect(availability).toHaveBeenCalledWith({
      page: 2,
      limit: 5,
      date: '2099-11-03',
      idDoctor: 3,
      idSpecialty: 4,
    });
    expect(findOriginal).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ doctor: { idDoctor: 3 } }) as unknown,
      }),
    );
  });
  it('rejects absent or other-doctor appointments before starting a transaction', async () => {
    findOriginal.mockResolvedValue(null);
    await expect(service.proposeRescheduling(9, 7, dto)).rejects.toBeInstanceOf(NotFoundException);
    expect(transaction).not.toHaveBeenCalled();
  });
  it('requires an active authenticated doctor profile', async () => {
    ownDoctor.mockRejectedValue(new ForbiddenException());
    await expect(service.proposeRescheduling(9, 7, dto)).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
  });
  it.each(['RESERVED', 'RESCHEDULED', 'COMPLETED'])(
    'rejects incompatible state %s',
    async (status) => {
      original.status = status;
      await expect(service.proposeRescheduling(9, 7, dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(save).not.toHaveBeenCalled();
    },
  );
  it('rechecks state after obtaining locks', async () => {
    lockedOriginal.getOne.mockResolvedValue({ ...original, status: 'RESERVED' });
    await expect(service.proposeRescheduling(9, 7, dto)).rejects.toBeInstanceOf(ConflictException);
    expect(save).not.toHaveBeenCalled();
  });
  it('rejects unavailable schedules and stale versions', async () => {
    target.mockResolvedValueOnce({ idSchedule: 5, version: 3 });
    await expect(service.proposeRescheduling(9, 7, dto)).rejects.toBeInstanceOf(ConflictException);
    available.getOne.mockResolvedValue(null);
    await expect(service.proposeRescheduling(9, 7, dto)).rejects.toBeInstanceOf(ConflictException);
    expect(save).not.toHaveBeenCalled();
  });
  it('stores linked snapshots and the authenticated actor without updating the original', async () => {
    expect(await service.proposeRescheduling(9, 7, dto)).toMatchObject({
      idProposal: 1,
      status: 'PENDING',
      originalDate: '2099-11-02',
      date: '2099-11-03',
    });
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        appointment: original,
        scheduleVersion: 2,
        createdBy: 7,
        originalStartTime: '09:00:00',
        startTime: '11:00:00',
      }),
    );
    expect(original.status).toBe('CANCELLED');
    expect(ownDoctor).toHaveBeenCalledTimes(2);
  });
  it('does not expose another patient proposal history', async () => {
    findOriginal.mockResolvedValue(null);
    await expect(service.patientProposals(9, 8, { page: 1, limit: 10 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findOriginal).toHaveBeenCalledWith({ idAppointment: 9, patient: { idUser: 8 } });
  });
});
