import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateEncounterDto } from 'src/dtos/encounters/create-encounter.dto';
import { Encounter } from 'src/entities/encounters/encounter.entity';
import { MedicalRecord } from 'src/entities/medical-records/medical-record.entity';
import { Appointment, AppointmentStatus } from 'src/entities/appointments/appointment.entity';
import { Doctor } from 'src/entities/doctors/doctors.entity';
import { User } from 'src/entities/users/users.entity';
import { Specialty } from 'src/entities/specialties/specialties.entity';
import { SchedulesService } from '../schedules/schedules.service';

@Injectable()
export class EncountersService {
  constructor(
    private readonly source: DataSource,
    private readonly schedules: SchedulesService,
  ) {}

  async create(dto: CreateEncounterDto, idUser: number) {
    return this.source.transaction(async (manager) => {
      const doctor = await this.schedules.ownDoctor(manager, idUser);
      // Same doctor-first lock order as schedules and appointments.
      await manager.getRepository(Doctor).findOne({
        where: { idDoctor: doctor.idDoctor },
        lock: { mode: 'pessimistic_write' },
      });
      await this.schedules.ownDoctor(manager, idUser);
      let appointment: Appointment | null = null;
      let idPatient = dto.idPatient;
      let idSpecialty = dto.idSpecialty;
      const occurredAt = new Date();
      if (dto.idAppointment !== undefined) {
        appointment = await manager.getRepository(Appointment).findOne({
          where: {
            idAppointment: dto.idAppointment,
            doctor: { idDoctor: doctor.idDoctor },
            isActive: true,
          },
          relations: { patient: true, specialty: true },
        });
        if (!appointment) throw new NotFoundException('Cita propia no encontrada');
        if (
          appointment.status !== AppointmentStatus.RESERVED ||
          Date.parse(`${appointment.date}T${appointment.startTime}-04:00`) > occurredAt.getTime()
        )
          throw new ConflictException('La cita debe estar reservada y haber iniciado');
        if (
          (idPatient !== undefined && idPatient !== appointment.patient.idUser) ||
          (idSpecialty !== undefined && idSpecialty !== appointment.specialty.idSpecialty)
        )
          throw new BadRequestException(
            'El paciente y la especialidad deben corresponder a la cita',
          );
        idPatient = appointment.patient.idUser;
        idSpecialty = appointment.specialty.idSpecialty;
      }
      if (!idPatient || !idSpecialty)
        throw new BadRequestException('Selecciona paciente y especialidad');
      const patient = await manager.getRepository(User).findOne({
        where: { idUser: idPatient, isActive: true, roles: { name: 'PATIENT', isActive: true } },
      });
      if (!patient) throw new NotFoundException('Paciente activo no encontrado');
      const specialty = await manager.getRepository(Specialty).findOne({
        where: { idSpecialty, isActive: true },
      });
      // A booked specialty remains historically valid even if removed from current assignments.
      if (
        !specialty ||
        (!appointment &&
          !(await manager.getRepository(Doctor).existsBy({
            idDoctor: doctor.idDoctor,
            specialties: { idSpecialty },
          })))
      )
        throw new BadRequestException('Especialidad activa no asignada al médico');
      const repository = manager.getRepository(Encounter);
      const records = manager.getRepository(MedicalRecord);
      // The unique patient key also serializes first encounters from different doctors.
      // Do not update existing records or grant access merely because one exists.
      await records
        .createQueryBuilder()
        .insert()
        .values({ idPatient, createdBy: idUser })
        .onConflict('("id_patient") DO NOTHING')
        .execute();
      const medicalRecord = await records.findOneOrFail({
        where: { idPatient },
        withDeleted: true,
      });
      const encounter = await repository.save(
        repository.create({
          patient,
          medicalRecord,
          doctor,
          specialty,
          appointment,
          occurredAt,
          summary: dto.summary,
          createdBy: idUser,
        }),
      );
      // Acknowledgement only: never return the clinical text or account entities.
      return {
        idEncounter: encounter.idEncounter,
        idPatient,
        idDoctor: doctor.idDoctor,
        idSpecialty,
        idAppointment: appointment?.idAppointment ?? null,
        occurredAt,
      };
    });
  }
}
