import { normalizeEmail } from 'src/common/utils/normalize-email';
import { UserUpdateDto } from 'src/dtos/users/users-update.dto';
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RegisterPatientDto } from 'src/dtos/auth/register-patient.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { UserCreateDto } from 'src/dtos/users/users.dto';
import { User } from 'src/entities/users/users.entity';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { UsersQueryDto } from 'src/dtos/users/users-query.dto';
import { statusFilter } from 'src/common/utils/status-filter';
import { paginate } from 'src/common/utils/paginate';

import * as bcrypt from 'bcrypt';

import { RolesService } from '../roles/roles.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly rolesService: RolesService,
  ) {}

  private readonly logger = new Logger(UsersService.name);

  private assertHasRoles(roles: unknown[] | undefined) {
    if (!roles?.length) throw new BadRequestException('El usuario debe tener al menos un rol');
  }

  async createPatient(dto: RegisterPatientDto, authorId?: number) {
    try {
      return await this.create(
        {
          name: dto.name,
          lastname: dto.lastname,
          email: dto.email,
          ci: dto.ci,
          password: dto.password,
          roleNames: ['PATIENT'],
        },
        authorId,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        if (error.message === 'User already exists')
          throw new BadRequestException(
            'Ya existe una cuenta con ese correo electrónico o documento',
          );
        if (error.message === 'Role not found: PATIENT')
          throw new ServiceUnavailableException(
            'El registro de pacientes no está disponible temporalmente',
          );
      }
      throw error;
    }
  }

  async searchForPatientRegistration(query: UsersQueryDto) {
    if (!query.search || query.search.trim().length < 3)
      throw new BadRequestException(
        'Ingresa al menos 3 caracteres para buscar por nombre, correo o documento',
      );
    const result = await this.getAll(query);
    return {
      ...result,
      data: result.data.map((user) => ({
        idUser: user.idUser,
        name: user.name,
        lastname: user.lastname,
        email: user.email,
        ci: user.ci,
        isActive: user.isActive,
        isPatient: (user.roles ?? []).some((role) => role.name === 'PATIENT'),
      })),
    };
  }

  async getAll(query: UsersQueryDto = new UsersQueryDto()) {
    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'roles')
      .orderBy('user.idUser', 'ASC');

    const filter = statusFilter(query.status);
    if (filter.isActive !== undefined) qb.andWhere('user.isActive = :isActive', filter);
    if (query.search?.trim()) {
      qb.andWhere(
        '(user.name ILIKE :search OR user.lastname ILIKE :search OR user.email ILIKE :search OR user.ci ILIKE :search)',
        { search: `%${query.search.trim().replace(/[\\%_]/g, '\\$&')}%` },
      );
    }
    return paginate(qb, query);
  }

  async create(userCreateDto: UserCreateDto, authorId?: number): Promise<User> {
    userCreateDto = { ...userCreateDto, email: normalizeEmail(userCreateDto.email) };
    this.assertHasRoles(userCreateDto.roleNames);
    const user = await this.userRepository.findOne({
      where: [{ email: userCreateDto.email }, { ci: userCreateDto.ci }],
    });
    if (user) throw new BadRequestException('User already exists');

    const roles = await Promise.all(
      [...new Set(userCreateDto.roleNames.map((name) => name.toUpperCase().trim()))].map(
        async (name) => {
          const role = await this.rolesService.getOneByName(name);
          if (!role) throw new BadRequestException(`Role not found: ${name}`);
          return role;
        },
      ),
    );
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(userCreateDto.password, salt);
    const userCreated = this.userRepository.create({
      ...userCreateDto,
      password: hash,
      roles,
    });
    if (authorId !== undefined) userCreated.createdBy = authorId;
    try {
      return await this.userRepository.save(userCreated);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      )
        throw new BadRequestException('User already exists');
      throw error;
    }
  }

  async getOneByEmail(email: string) {
    return this.userRepository.findOne({
      where: { email: normalizeEmail(email), isActive: true },
      relations: {
        roles: {
          permissions: true,
        },
      },
    });
  }

  async getForAuthentication(email: string) {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.roles', 'roles')
      .leftJoinAndSelect('roles.permissions', 'permissions')
      .where('user.email = :email AND user.isActive = :isActive', {
        email: normalizeEmail(email),
        isActive: true,
      })
      .getOne();
  }

  async getOneById(idUser: number) {
    return this.userRepository.findOne({
      where: { idUser, isActive: true },
      relations: {
        roles: {
          permissions: true,
        },
      },
    });
  }

  async getAdministrativeDetail(idUser: number) {
    const user = await this.userRepository.findOne({
      where: { idUser },
      relations: { roles: true },
    });
    if (!user) throw new BadRequestException('User not found');
    return user;
  }

  async assignRoles(
    idUser: number,
    roleNames: string[],
    authorId: number,
    replace = false,
    manager?: EntityManager,
  ) {
    const repository = manager?.getRepository(User) ?? this.userRepository;
    if (replace) this.assertHasRoles(roleNames);
    const user = await repository.findOne({
      where: replace ? { idUser } : { idUser, isActive: true },
      relations: ['roles'],
    });
    if (!user) throw new BadRequestException('User not found');
    const roles = replace ? [] : [...(user.roles ?? [])];
    for (const rn of new Set(roleNames.map((name) => name.toUpperCase().trim()))) {
      // Preserve existing inactive associations, but never grant new inactive roles.
      const role =
        (replace ? user.roles.find((assigned) => assigned.name === rn) : undefined) ??
        (await (manager
          ? this.rolesService.getOneByName(rn, manager)
          : this.rolesService.getOneByName(rn)));
      if (!role) throw new BadRequestException(`Role not found: ${rn}`);

      const alreadyAssigned = roles.some((r) => r.idRole === role.idRole);
      if (alreadyAssigned) throw new BadRequestException(`Role already assigned: ${rn}`);

      roles.push(role);
    }

    this.assertHasRoles(roles);
    user.roles = roles;
    user.updatedAt = new Date();
    user.updatedBy = authorId;
    return repository.save(user);
  }

  async delete(idUser: number, authorId: number) {
    if (idUser === authorId) {
      throw new BadRequestException('No puedes desactivar tu propia cuenta');
    }
    const user = await this.userRepository.findOne({
      where: { idUser: idUser, isActive: true },
    });
    if (!user) throw new BadRequestException('User not found');
    user.isActive = false;
    user.deletedBy = authorId;
    user.updatedBy = authorId;
    return this.userRepository.save(user);
  }

  async reactivate(idUser: number, authorId: number) {
    const user = await this.userRepository.findOne({
      where: { idUser: idUser, isActive: false },
      relations: ['roles'],
    });
    if (!user) throw new BadRequestException('User not found');
    this.assertHasRoles(user.roles);
    user.isActive = true;
    user.updatedBy = authorId;
    return this.userRepository.save(user);
  }

  async update(idUser: number, dto: UserUpdateDto, authorId: number, manager?: EntityManager) {
    const repository = manager?.getRepository(User) ?? this.userRepository;
    if (dto.email !== undefined) dto = { ...dto, email: normalizeEmail(dto.email) };
    const user = await repository.findOne({ where: { idUser }, relations: ['roles'] });
    if (!user) throw new BadRequestException('User not found');
    this.assertHasRoles(user.roles);
    for (const field of ['email', 'ci'] as const) {
      if (dto[field] !== undefined) {
        const duplicate = await repository.findOne({ where: { [field]: dto[field] } });
        if (duplicate && duplicate.idUser !== idUser)
          throw new BadRequestException(`${field} already exists`);
      }
    }
    // Explicit fields keep role assignment behind its own permission.
    const { email, name, lastname, ci } = dto;
    repository.merge(user, { email, name, lastname, ci });
    user.updatedBy = authorId;
    const saved = await repository.save(user);
    return {
      idUser: saved.idUser,
      email: saved.email,
      name: saved.name,
      lastname: saved.lastname,
      ci: saved.ci,
      isActive: saved.isActive,
    };
  }
}
