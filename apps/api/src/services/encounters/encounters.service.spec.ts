import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EncountersService } from './encounters.service';
import { SchedulesService } from '../schedules/schedules.service';
import { Doctor } from 'src/entities/doctors/doctors.entity';
import { User } from 'src/entities/users/users.entity';
import { Specialty } from 'src/entities/specialties/specialties.entity';
import { Appointment } from 'src/entities/appointments/appointment.entity';
import { Encounter } from 'src/entities/encounters/encounter.entity';

describe('Clinical encounter creation', () => {
  const doctor = { idDoctor: 3 };
  const patient = { idUser: 5 };
  const specialty = { idSpecialty: 7 };
  const appointment = {
    idAppointment: 9,
    patient,
    specialty,
    status: 'RESERVED',
    date: '2000-01-01',
    startTime: '09:00:00',
  };
  const repositories = new Map<
    unknown,
    { findOne: jest.Mock; existsBy: jest.Mock; create: jest.Mock; save: jest.Mock }
  >();
  const schedules = { ownDoctor: jest.fn() };
  let service: EncountersService;
  beforeEach(() => {
    jest.resetAllMocks();
    for (const entity of [Doctor, User, Specialty, Appointment, Encounter]) {
      repositories.set(entity, {
        findOne: jest.fn(),
        existsBy: jest.fn(),
        create: jest.fn((value: unknown) => value),
        save: jest.fn((value: Record<string, unknown>) =>
          Promise.resolve({ ...value, idEncounter: 11 }),
        ),
      });
    }
    repositories.get(Doctor)!.findOne.mockResolvedValue(doctor);
    repositories.get(Doctor)!.existsBy.mockResolvedValue(true);
    repositories.get(User)!.findOne.mockResolvedValue(patient);
    repositories.get(Specialty)!.findOne.mockResolvedValue(specialty);
    repositories.get(Appointment)!.findOne.mockResolvedValue(appointment);
    schedules.ownDoctor.mockResolvedValue(doctor);
    const manager = { getRepository: (entity: unknown) => repositories.get(entity) };
    service = new EncountersService(
      {
        transaction: (callback: (value: unknown) => unknown) => callback(manager),
      } as unknown as DataSource,
      schedules as unknown as SchedulesService,
    );
  });
  const input = { idPatient: 5, idSpecialty: 7, summary: 'Clinical text' };
  it('appends independent encounters without overwriting and returns no clinical content', async () => {
    const receipt = await service.create(input, 2);
    await service.create(input, 2);
    expect(receipt).toEqual({
      idEncounter: 11,
      idPatient: 5,
      idDoctor: 3,
      idSpecialty: 7,
      idAppointment: null,
      occurredAt: expect.any(Date) as Date,
    });
    expect(repositories.get(Encounter)!.save).toHaveBeenCalledTimes(2);
    expect(repositories.get(Encounter)!.create).toHaveBeenCalledWith(
      expect.objectContaining({ patient, doctor, specialty, createdBy: 2, summary: input.summary }),
    );
    expect(schedules.ownDoctor).toHaveBeenCalledWith(expect.anything(), 2);
  });
  it('derives patient and specialty from an own appointment', async () => {
    await service.create({ idAppointment: 9, summary: 'Text' }, 2);
    expect(repositories.get(Appointment)!.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { idAppointment: 9, doctor: { idDoctor: 3 }, isActive: true },
      }),
    );
    expect(repositories.get(Encounter)!.create).toHaveBeenCalledWith(
      expect.objectContaining({ appointment, patient, specialty }),
    );
  });
  it('requires an eligible medical profile even with a permission', async () => {
    schedules.ownDoctor.mockRejectedValue(new ForbiddenException());
    await expect(service.create(input, 2)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repositories.get(Encounter)!.save).not.toHaveBeenCalled();
  });
  it('rejects missing or foreign appointments', async () => {
    repositories.get(Appointment)!.findOne.mockResolvedValue(null);
    await expect(service.create({ idAppointment: 99, summary: 'Text' }, 2)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
  it.each(['CANCELLED', 'RESCHEDULED'])('rejects %s appointments', async (status) => {
    repositories.get(Appointment)!.findOne.mockResolvedValue({ ...appointment, status });
    await expect(service.create({ idAppointment: 9, summary: 'Text' }, 2)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
  it('rejects appointments that have not started', async () => {
    repositories
      .get(Appointment)!
      .findOne.mockResolvedValue({ ...appointment, date: '2099-01-01' });
    await expect(service.create({ idAppointment: 9, summary: 'Text' }, 2)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
  it.each([{ idPatient: 999 }, { idSpecialty: 999 }])(
    'rejects mismatched appointment relations %j',
    async (forged) => {
      await expect(
        service.create({ ...input, idAppointment: 9, ...forged }, 2),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repositories.get(Encounter)!.save).not.toHaveBeenCalled();
    },
  );
  it('rejects nonexistent, inactive or non-patient accounts', async () => {
    repositories.get(User)!.findOne.mockResolvedValue(null);
    await expect(service.create(input, 2)).rejects.toBeInstanceOf(NotFoundException);
    expect(repositories.get(User)!.findOne).toHaveBeenCalledWith({
      where: { idUser: 5, isActive: true, roles: { name: 'PATIENT', isActive: true } },
    });
  });
  it('rejects missing or inactive specialties', async () => {
    repositories.get(Specialty)!.findOne.mockResolvedValue(null);
    await expect(service.create(input, 2)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('requires an assigned specialty when no appointment exists', async () => {
    repositories.get(Doctor)!.existsBy.mockResolvedValue(false);
    await expect(service.create(input, 2)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('propagates storage failure without returning a successful receipt', async () => {
    repositories.get(Encounter)!.save.mockRejectedValue(new Error('storage failure'));
    await expect(service.create(input, 2)).rejects.toThrow('storage failure');
  });
});
