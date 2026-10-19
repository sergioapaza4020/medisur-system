import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Appointment } from 'src/entities/appointments/appointment.entity';
import { Doctor } from 'src/entities/doctors/doctors.entity';
import { SchedulesService } from '../schedules/schedules.service';
import { AppointmentsService } from './appointments.service';

describe('Own appointment cancellation transaction', () => {
  const cancelledAt = new Date('2026-10-19T12:00:00Z');
  let initial: jest.Mock;
  let qb: Record<string, jest.Mock>;
  let locks: string[];
  let service: AppointmentsService;
  beforeEach(() => {
    locks = [];
    initial = jest.fn().mockResolvedValue({
      idAppointment: 9,
      doctor: { idDoctor: 3 },
      schedule: { idSchedule: 4 },
    });
    qb = Object.fromEntries(
      ['where', 'andWhere', 'setLock', 'update', 'set', 'returning'].map((name) => [
        name,
        jest.fn().mockReturnThis(),
      ]),
    );
    qb.getOne = jest.fn(() => {
      locks.push('appointment');
      return Promise.resolve({ idAppointment: 9 });
    });
    qb.execute = jest.fn().mockResolvedValue({
      affected: 1,
      raw: [{ id_appointment: 9, status: 'CANCELLED', cancelled_at: cancelledAt }],
    });
    const repository = { findOne: initial, createQueryBuilder: () => qb };
    const manager = {
      getRepository: (entity: unknown) =>
        entity === Appointment
          ? repository
          : {
              findOne: jest.fn(() => {
                locks.push(entity === Doctor ? 'doctor' : 'schedule');
                return Promise.resolve({});
              }),
            },
    };
    service = new AppointmentsService(
      {
        transaction: (callback: (manager: unknown) => unknown) => callback(manager),
      } as unknown as DataSource,
      {} as SchedulesService,
    );
  });
  it('scopes ownership, serializes with booking and sets audit inside the same transaction', async () => {
    expect(await service.cancelMine(9, 7)).toEqual({
      idAppointment: 9,
      status: 'CANCELLED',
      cancelledAt,
    });
    expect(initial).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ idAppointment: 9, patient: { idUser: 7 } }) as unknown,
      }),
    );
    expect(locks).toEqual(['doctor', 'schedule', 'appointment']);
    expect(qb.where).toHaveBeenCalledWith(
      'id_appointment = :idAppointment AND id_patient = :idUser',
      { idAppointment: 9, idUser: 7 },
    );
    expect(qb.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'CANCELLED', cancelledBy: 7, updatedBy: 7 }),
    );
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('clock_timestamp()'), {
      timeZone: 'America/La_Paz',
    });
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('status = :status'), {
      status: 'RESERVED',
    });
    expect(qb.update).toHaveBeenCalledWith(Appointment);
  });
  it('does not modify absent or other-patient appointments', async () => {
    initial.mockResolvedValue(null);
    await expect(service.cancelMine(9, 8)).rejects.toBeInstanceOf(NotFoundException);
    expect(qb.execute).not.toHaveBeenCalled();
    expect(locks).toEqual([]);
  });
  it('fails closed when the appointment disappears before its lock', async () => {
    qb.getOne.mockResolvedValue(null);
    await expect(service.cancelMine(9, 7)).rejects.toBeInstanceOf(NotFoundException);
    expect(qb.execute).not.toHaveBeenCalled();
  });
  it('rejects incompatible state or elapsed time without a cancellation result', async () => {
    qb.execute.mockResolvedValue({ affected: 0, raw: [] });
    await expect(service.cancelMine(9, 7)).rejects.toBeInstanceOf(ConflictException);
  });
  it('propagates write errors so the transaction rolls back the cancellation and audit together', async () => {
    qb.execute.mockRejectedValue(new Error('Write failure'));
    await expect(service.cancelMine(9, 7)).rejects.toThrow('Write failure');
  });
});
