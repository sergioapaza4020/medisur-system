import { normalizeEmail } from 'src/common/utils/normalize-email';
import { UserUpdateDto } from 'src/dtos/users/users-update.dto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserCreateDto } from 'src/dtos/users/users.dto';
import { User } from 'src/entities/users/users.entity';
import { QueryFailedError, Repository } from 'typeorm';
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

  async assignRoles(idUser: number, roleNames: string[], authorId: number, replace = false) {
    if (replace) this.assertHasRoles(roleNames);
    const user = await this.userRepository.findOne({
      where: replace ? { idUser } : { idUser, isActive: true },
      relations: ['roles'],
    });
    if (!user) throw new BadRequestException('User not found');
    const roles = replace ? [] : [...(user.roles ?? [])];
    for (const rn of new Set(roleNames.map((name) => name.toUpperCase().trim()))) {
      // Preserve existing inactive associations, but never grant new inactive roles.
      const role =
        (replace ? user.roles.find((assigned) => assigned.name === rn) : undefined) ??
        (await this.rolesService.getOneByName(rn));
      if (!role) throw new BadRequestException(`Role not found: ${rn}`);

      const alreadyAssigned = roles.some((r) => r.idRole === role.idRole);
      if (alreadyAssigned) throw new BadRequestException(`Role already assigned: ${rn}`);

      roles.push(role);
    }

    this.assertHasRoles(roles);
    user.roles = roles;
    user.updatedAt = new Date();
    user.updatedBy = authorId;
    return this.userRepository.save(user);
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

  async update(idUser: number, dto: UserUpdateDto, authorId: number) {
    if (dto.email !== undefined) dto = { ...dto, email: normalizeEmail(dto.email) };
    const user = await this.userRepository.findOne({ where: { idUser }, relations: ['roles'] });
    if (!user) throw new BadRequestException('User not found');
    this.assertHasRoles(user.roles);
    for (const field of ['email', 'ci'] as const) {
      if (dto[field] !== undefined) {
        const duplicate = await this.userRepository.findOne({ where: { [field]: dto[field] } });
        if (duplicate && duplicate.idUser !== idUser)
          throw new BadRequestException(`${field} already exists`);
      }
    }
    // Explicit fields keep role assignment behind its own permission.
    const { email, name, lastname, ci } = dto;
    this.userRepository.merge(user, { email, name, lastname, ci });
    user.updatedBy = authorId;
    const saved = await this.userRepository.save(user);
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
