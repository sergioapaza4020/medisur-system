import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, Not, QueryFailedError } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from 'src/entities/users/users.entity';
import { hashPassword } from 'src/database/utils/password.util';
import { ChangeMyPasswordDto, UpdateMyAccountDto } from 'src/dtos/users/my-account.dto';
import { SessionsService } from '../sessions/sessions.service';
import { UsersService } from './users.service';
import { StorageService } from '../storage/storage.service';
import { avatarUrl } from './avatar.util';

@Injectable()
export class MyAccountService {
  private readonly logger = new Logger(MyAccountService.name);
  constructor(
    private readonly users: UsersService,
    private readonly dataSource: DataSource,
    private readonly sessions: SessionsService,
    private readonly storage: StorageService,
  ) {}

  async get(idUser: number) {
    const user = await this.users.getOneById(idUser);
    if (!user) throw new UnauthorizedException('Sesión no válida');
    return this.profile(user);
  }

  private profile(user: Pick<User, 'name' | 'lastname' | 'email' | 'ci' | 'avatar'>) {
    return {
      name: user.name,
      lastname: user.lastname,
      email: user.email,
      ci: user.ci,
      avatarUrl: avatarUrl(this.storage, user.avatar),
      avatarUpload: this.storage.getImagePolicy(),
    };
  }

  async update(idUser: number, dto: UpdateMyAccountDto) {
    await this.get(idUser);
    const { name, lastname, email, ci } = dto;
    try {
      await this.dataSource.transaction(async (manager) => {
        const current = await manager.getRepository(User).findOne({
          where: { idUser, isActive: true },
          lock: { mode: 'pessimistic_write' },
        });
        if (!current) throw new UnauthorizedException('Sesión no válida');
        await this.users.update(idUser, { name, lastname, email, ci }, idUser, manager);
      });
      return this.get(idUser);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      )
        throw new BadRequestException('El correo electrónico o documento ya está registrado');
      throw error;
    }
  }

  async uploadAvatar(idUser: number, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Selecciona una imagen');
    const user = await this.users.getOneById(idUser);
    if (!user) throw new UnauthorizedException('Sesión no válida');
    const previous = user.avatar ?? null;
    // A legacy non-managed value is never passed to Storage for deletion.
    const previousKey = avatarUrl(this.storage, previous) ? previous : null;
    const image = await this.storage.replace(
      previousKey,
      { buffer: file.buffer, mimeType: file.mimetype, context: 'profiles' },
      async (uploaded) => {
        await this.dataSource.transaction(async (manager) => {
          const repository = manager.getRepository(User);
          const current = await repository.findOne({
            where: { idUser, isActive: true },
            lock: { mode: 'pessimistic_write' },
          });
          if (!current) throw new UnauthorizedException('Sesión no válida');
          if ((current.avatar ?? null) !== previous)
            throw new ConflictException(
              'La foto cambió en otra solicitud. Actualiza la cuenta e intenta nuevamente.',
            );
          await repository.update({ idUser }, { avatar: uploaded.key, updatedBy: idUser });
        });
      },
    );
    return { avatarUrl: image.url, cleanupPending: image.cleanupPending };
  }

  async deleteAvatar(idUser: number) {
    const previousKey = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(User);
      const user = await repository.findOne({
        where: { idUser, isActive: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new UnauthorizedException('Sesión no válida');
      const key = avatarUrl(this.storage, user.avatar) ? user.avatar : null;
      await repository.update({ idUser }, { avatar: null, updatedBy: idUser });
      return key;
    });
    let cleanupPending = false;
    if (previousKey) {
      try {
        await this.storage.delete(previousKey);
      } catch {
        cleanupPending = true;
        this.logger.warn({ operation: 'avatar-delete-cleanup', key: previousKey });
      }
    }
    return { avatarUrl: null, cleanupPending };
  }

  async changePassword(idUser: number, dto: ChangeMyPasswordDto) {
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(User);
      const user = await repository
        .createQueryBuilder('user')
        .addSelect('user.password')
        .where('user.idUser = :idUser AND user.isActive = true', { idUser })
        .setLock('pessimistic_write')
        .getOne();
      if (!user) throw new UnauthorizedException('Sesión no válida');
      if (!(await bcrypt.compare(dto.currentPassword, user.password)))
        throw new BadRequestException('La contraseña actual es incorrecta');
      if (await bcrypt.compare(dto.password, user.password))
        throw new BadRequestException('La nueva contraseña debe ser diferente de la actual');
      user.password = await hashPassword(dto.password);
      user.updatedBy = idUser;
      await repository.save(user);
      await this.sessions.revokeForPasswordChange(idUser, manager);
    });
  }

  async deactivate(idUser: number) {
    await this.dataSource.transaction(async (manager) => {
      // Serialize self-deactivations so two administrators cannot both be the last.
      await manager.query('SELECT pg_advisory_xact_lock(81008)');
      const repository = manager.getRepository(User);
      const user = await repository.findOne({
        where: { idUser, isActive: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new UnauthorizedException('Sesión no válida');
      const administrator = await repository.exists({
        where: { idUser, roles: { name: 'SUPERADMIN', isActive: true } },
      });
      if (
        administrator &&
        !(await repository.exists({
          where: {
            idUser: Not(idUser),
            isActive: true,
            roles: { name: 'SUPERADMIN', isActive: true },
          },
        }))
      )
        throw new BadRequestException('No puedes desactivar al último SUPERADMIN activo');
      user.isActive = false;
      user.deletedBy = idUser;
      user.updatedBy = idUser;
      await repository.save(user);
      await this.sessions.revokeAllSessions(idUser, user, manager);
    });
  }
}
