import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { User } from 'src/entities/users/users.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { SessionRevokeReasons } from '@common/enums/sessionRevokeReasons';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(UserSession)
    private readonly sessionRepository: Repository<UserSession>,
  ) {}

  async createSession(params: {
    user: User;
    refreshToken: string;
    ipAddress?: string;
    userAgent?: string;
    browser?: string;
    os?: string;
    device?: string;
    lastUsedAt: Date;
  }): Promise<UserSession> {
    const hashedRefreshToken = await bcrypt.hash(params.refreshToken, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const session = this.sessionRepository.create({
      user: params.user,
      refreshToken: hashedRefreshToken,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      browser: params.browser,
      os: params.os,
      device: params.device,
      lastUsedAt: params.lastUsedAt,
      expiresAt,
    });

    return this.sessionRepository.save(session);
  }

  async getAllSessions(): Promise<UserSession[]> {
    return this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.user', 'user')
      .orderBy('session.isActive', 'DESC')
      .addOrderBy('session.lastUsedAt', 'DESC', 'NULLS LAST')
      .getMany();
  }

  async getUserSessions(idUser: number): Promise<UserSession[]> {
    return this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.user', 'user')
      .where('user.id_user = :idUser', { idUser })
      .orderBy('session.isActive', 'DESC')
      .addOrderBy('session.lastUsedAt', 'DESC', 'NULLS LAST')
      .getMany();
  }

  async findActiveSessionByUser(idUser: number): Promise<UserSession | null> {
    return this.sessionRepository.findOne({
      where: {
        user: { idUser },
        isActive: true,
      },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async validateRefreshToken(refreshToken: string): Promise<UserSession> {
    const sessions = await this.sessionRepository.find({
      where: {
        isActive: true,
      },
      relations: ['user'],
    });

    for (const session of sessions) {
      const isMatch = await bcrypt.compare(refreshToken, session.refreshToken);
      if (isMatch) {
        return session;
      }
    }

    throw new UnauthorizedException('Invalid token refresh');
  }

  async updateLastSessionUsed(session: UserSession): Promise<UserSession> {
    session.lastUsedAt = new Date();

    return this.sessionRepository.save(session);
  }

  async revokeSession(session: UserSession, revokedBy?: User): Promise<UserSession> {
    session.isActive = false;

    session.revokedAt = new Date();
    session.revokedReason = SessionRevokeReasons.LOGOUT;

    if (revokedBy) session.revokedBy = revokedBy;

    return this.sessionRepository.save(session);
  }

  async revokeSessionById(idSession: number, revokedBy?: User): Promise<UserSession> {
    const session = await this.sessionRepository.findOne({
      where: { idSession },
      relations: ['user'],
    });
    if (!session) throw new NotFoundException('Session not found');

    session.isActive = false;
    session.revokedAt = new Date();
    session.revokedReason = SessionRevokeReasons.ADMIN_ACTION;

    if (revokedBy) session.revokedBy = revokedBy;

    return this.sessionRepository.save(session);
  }

  async revokeAllSessions(idUser: number, revokedBy?: User): Promise<void> {
    const sessions = await this.sessionRepository.find({
      where: {
        user: { idUser },
        isActive: true,
      },
      relations: ['user'],
    });

    for (const session of sessions) {
      session.isActive = false;
      session.revokedAt = new Date();
      session.revokedReason = SessionRevokeReasons.LOGOUT_ALL;

      if (revokedBy) session.revokedBy = revokedBy;

      await this.sessionRepository.save(session);
    }
  }

  async logout(refreshToken: string, revokedBy?: User) {
    const session = await this.validateRefreshToken(refreshToken);

    return this.revokeSession(session, revokedBy);
  }
}
