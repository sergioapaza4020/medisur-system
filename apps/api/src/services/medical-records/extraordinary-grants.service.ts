import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { paginate } from '@common/utils/paginate';
import { PaginatedResult } from '@common/types/pagination.type';
import { ExtraordinaryGrantView } from '@common/types/extraordinary-grant.type';
import { PaginationQueryDto } from 'src/dtos/common/pagination-query.dto';
import { CreateExtraordinaryGrantDto } from 'src/dtos/medical-records/extraordinary-grant.dto';
import { ExtraordinaryGrant } from 'src/entities/medical-records/extraordinary-grant.entity';
import { Doctor } from 'src/entities/doctors/doctors.entity';
import { User } from 'src/entities/users/users.entity';
import { SchedulesService } from '../schedules/schedules.service';

@Injectable()
export class ExtraordinaryGrantsService {
  constructor(
    private readonly source: DataSource,
    private readonly schedules: SchedulesService,
  ) {}

  async create(dto: CreateExtraordinaryGrantDto, idActor: number) {
    if (dto.idBeneficiary === idActor)
      throw new ForbiddenException('No puedes concederte acceso extraordinario');
    return this.source.transaction(async (manager) => {
      const doctor = await this.schedules.ownDoctor(manager, dto.idBeneficiary);
      await manager
        .getRepository(Doctor)
        .findOne({ where: { idDoctor: doctor.idDoctor }, lock: { mode: 'pessimistic_write' } });
      await this.schedules.ownDoctor(manager, dto.idBeneficiary);
      const beneficiary = await manager
        .getRepository(User)
        .createQueryBuilder('beneficiary')
        .select('beneficiary.idUser')
        .innerJoin('beneficiary.roles', 'role', 'role.isActive = true')
        .innerJoin(
          'role.permissions',
          'permission',
          'permission.isActive = true AND permission.name = :permission',
          { permission: 'medical-record.get-extraordinary' },
        )
        .where('beneficiary.idUser = :id AND beneficiary.isActive = true', {
          id: dto.idBeneficiary,
        })
        .getOne();
      if (!beneficiary)
        throw new BadRequestException('El beneficiario requiere permiso de lectura extraordinaria');
      const patient = await manager
        .getRepository(User)
        .createQueryBuilder('patient')
        .select('patient.idUser')
        .innerJoin(
          'patient.roles',
          'patientRole',
          "patientRole.name = 'PATIENT' AND patientRole.isActive = true",
        )
        .where('patient.idUser = :id AND patient.isActive = true', { id: dto.idPatient })
        .setLock('pessimistic_read', undefined, ['patient'])
        .getOne();
      if (!patient) throw new BadRequestException('Paciente activo no encontrado');
      const repository = manager.getRepository(ExtraordinaryGrant);
      const overlap = await repository
        .createQueryBuilder('clinical_grant')
        .where(
          'clinical_grant.id_patient = :patient AND clinical_grant.id_beneficiary = :beneficiary',
          {
            patient: dto.idPatient,
            beneficiary: dto.idBeneficiary,
          },
        )
        .andWhere(
          'clinical_grant.revokedAt IS NULL AND clinical_grant.expiresAt > clock_timestamp()',
        )
        .getExists();
      if (overlap)
        throw new ConflictException(
          'Ya existe una autorización vigente para este médico y paciente',
        );
      const createdAt = new Date();
      const expiresAt = new Date(dto.expiresAt);
      if (
        !Number.isFinite(expiresAt.getTime()) ||
        expiresAt <= createdAt ||
        expiresAt.getTime() - createdAt.getTime() > 86400000
      )
        throw new BadRequestException('La vigencia debe ser futura y de hasta 24 horas');
      const grant = await repository.save(
        repository.create({
          patient,
          beneficiary,
          createdBy: { idUser: idActor },
          type: dto.type,
          reason: dto.reason,
          createdAt,
          expiresAt,
        }),
      );
      return { idGrant: grant.idGrant, expiresAt: grant.expiresAt };
    });
  }

  async revoke(idGrant: number, idActor: number, reason: string) {
    return this.source.transaction(async (manager) => {
      const repository = manager.getRepository(ExtraordinaryGrant);
      const grant = await repository.findOne({
        where: { idGrant },
        lock: { mode: 'pessimistic_write' },
      });
      if (!grant) throw new NotFoundException('Autorización no encontrada');
      if (grant.revokedAt) throw new ConflictException('La autorización ya fue revocada');
      const revokedAt = new Date();
      await repository.update(idGrant, {
        revokedAt,
        revokedBy: { idUser: idActor },
        revocationReason: reason,
      });
      return { idGrant, revokedAt };
    });
  }

  async list(
    query: PaginationQueryDto,
    idBeneficiary?: number,
  ): Promise<PaginatedResult<ExtraordinaryGrantView>> {
    if (idBeneficiary !== undefined)
      await this.schedules.ownDoctor(this.source.manager, idBeneficiary);
    const qb = this.source
      .getRepository(ExtraordinaryGrant)
      .createQueryBuilder('clinical_grant')
      .withDeleted()
      .innerJoinAndSelect('clinical_grant.patient', 'patient')
      .innerJoinAndSelect('clinical_grant.beneficiary', 'beneficiary')
      .select([
        'clinical_grant',
        'patient.idUser',
        'patient.name',
        'patient.lastname',
        'patient.ci',
        'patient.isActive',
        'patient.deletedAt',
        'beneficiary.idUser',
        'beneficiary.name',
        'beneficiary.lastname',
      ])
      .orderBy('clinical_grant.createdAt', 'DESC')
      .addOrderBy('clinical_grant.idGrant', 'DESC');
    if (idBeneficiary !== undefined)
      qb.where('clinical_grant.id_beneficiary = :idBeneficiary', { idBeneficiary }).andWhere(
        'clinical_grant.revokedAt IS NULL AND clinical_grant.expiresAt > clock_timestamp() AND patient.isActive = true AND patient.deletedAt IS NULL',
      );
    const result = await paginate(qb, query);
    return {
      ...result,
      data: result.data.map((grant) => ({
        idGrant: grant.idGrant,
        patient: {
          idUser: grant.patient.idUser,
          name: grant.patient.name,
          lastname: grant.patient.lastname,
          ci: grant.patient.ci,
        },
        beneficiary: {
          idUser: grant.beneficiary.idUser,
          name: grant.beneficiary.name,
          lastname: grant.beneficiary.lastname,
        },
        type: grant.type,
        reason: grant.reason,
        createdAt: grant.createdAt,
        expiresAt: grant.expiresAt,
        revokedAt: grant.revokedAt,
        revocationReason: grant.revocationReason,
        state: grant.revokedAt
          ? 'REVOKED'
          : grant.expiresAt.getTime() <= Date.now()
            ? 'EXPIRED'
            : 'ACTIVE',
      })),
    };
  }
}
