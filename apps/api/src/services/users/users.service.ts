import { UserUpdateDto } from 'src/dtos/users/users-update.dto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserCreateDto } from 'src/dtos/users/users.dto';
import { User } from 'src/entities/users/users.entity';
import { Repository } from 'typeorm';

import * as bcrypt from 'bcrypt';

import { RolesService } from '../roles/roles.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly rolesService: RolesService,
  ) {}

  private readonly logger = new Logger(UsersService.name);

  async getAll() {
    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.careers', 'career')
      .leftJoinAndSelect('user.roles', 'roles')
      .orderBy('user.idUser', 'ASC');

    const [data] = await qb.getManyAndCount();
    return {
      data,
    };
  }

  async create(userCreateDto: UserCreateDto): Promise<User> {
    const user = await this.userRepository.findOne({
      where: [{ email: userCreateDto.email }, { username: userCreateDto.username }],
    });
    if (user) throw new BadRequestException('User already exists');

    const roles = await Promise.all(
      userCreateDto.roleNames.map(async (name) => {
        const role = await this.rolesService.getOneByName(name.toUpperCase());
        if (!role) throw new BadRequestException(`Role not found: ${name}`);
        return role;
      }),
    );
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(userCreateDto.password, salt);
    const userCreated = this.userRepository.create({
      ...userCreateDto,
      password: hash,
      roles,
    });
    userCreated.createdBy = 0;
    return this.userRepository.save(userCreated);
  }

  async getOneByEmail(email: string) {
    return this.userRepository.findOne({
      where: { email, isActive: true },
      relations: {
        roles: {
          permissions: true,
        },
      },
    });
  }

  async getOneByUsername(username: string) {
    return this.userRepository.findOne({
      where: { username, isActive: true },
      relations: {
        roles: {
          permissions: true,
        },
      },
    });
  }

  async getForAuthentication(username: string) {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.roles', 'roles')
      .leftJoinAndSelect('roles.permissions', 'permissions')
      .where('user.username = :username AND user.isActive = :isActive', {
        username,
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

  async assignRoles(idUser: number, roleNames: string[]) {
    const user = await this.userRepository.findOne({
      where: { idUser, isActive: true },
      relations: ['roles'],
    });
    if (!user) throw new BadRequestException('User not found');
    for (const rn of roleNames) {
      const role = await this.rolesService.getOneByName(rn.toUpperCase());
      if (!role) throw new BadRequestException(`Role not found: ${rn}`);

      const alreadyAssigned = user.roles?.some((r) => r.name === rn);
      if (alreadyAssigned) throw new BadRequestException(`Role not found: ${rn}`);

      user.roles?.push(role);
    }

    user.updatedAt = new Date();
    return this.userRepository.save(user);
  }

  async delete(idUser: number) {
    const user = await this.userRepository.findOne({
      where: { idUser: idUser, isActive: true },
    });
    if (!user) throw new BadRequestException('User not found');
    user.isActive = false;
    return this.userRepository.save(user);
  }

  async reactivate(idUser: number) {
    const user = await this.userRepository.findOne({
      where: { idUser: idUser, isActive: false },
    });
    if (!user) throw new BadRequestException('User not found');
    user.isActive = true;
    return this.userRepository.save(user);
  }

  async update(idUser: number, dto: UserUpdateDto) {
    const user = await this.userRepository.findOne({ where: { idUser, isActive: true } });
    if (!user) throw new BadRequestException('User not found');
    for (const field of ['email', 'username'] as const) {
      if (dto[field] !== undefined) {
        const duplicate = await this.userRepository.findOne({ where: { [field]: dto[field] } });
        if (duplicate && duplicate.idUser !== idUser)
          throw new BadRequestException(`${field} already exists`);
      }
    }
    // Explicit fields keep role assignment behind its own permission.
    const { email, username, name, lastname, ci, password } = dto;
    this.userRepository.merge(user, { email, username, name, lastname, ci });
    if (password !== undefined) user.password = await bcrypt.hash(password, 10);
    const saved = await this.userRepository.save(user);
    return {
      idUser: saved.idUser,
      email: saved.email,
      username: saved.username,
      name: saved.name,
      lastname: saved.lastname,
      ci: saved.ci,
      isActive: saved.isActive,
    };
  }
}
