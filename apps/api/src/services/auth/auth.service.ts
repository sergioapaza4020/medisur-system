import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from 'src/dtos/auth/login.dto';

import * as bcrypt from 'bcrypt';
import { JwtPayload } from 'src/common/types/jwt-payload.type';
import { User } from 'src/entities/users/users.entity';
import { SessionsService } from '../sessions/sessions.service';
import { Request } from 'express';
import { UAParser } from 'ua-parser-js';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UsersService,
    private readonly sessionService: SessionsService,
  ) {}

  async validateUser(loginDto: LoginDto): Promise<User> {
    const { username, password } = loginDto;

    const user = await this.userService.getForAuthentication(username);
    if (!user) throw new UnauthorizedException('User not found');

    const checkPassword = await bcrypt.compare(password, user.password);
    if (!checkPassword) throw new UnauthorizedException('Wrong password');

    Reflect.deleteProperty(user, 'password');
    return user;
  }

  async login(loginDto: LoginDto, request: Request) {
    const user = await this.validateUser(loginDto);

    const refreshToken = this.jwtService.sign(
      { idUser: user.idUser },
      {
        secret: process.env.JWT_ACCESS_REFRESH,
        expiresIn: process.env.JWT_ACCESS_REFRESH_EXPIRES_IN as number | undefined,
      },
    );

    const ipAddress = request.ip || request.socket.remoteAddress;
    const userAgent = request.headers['user-agent'];

    const parser = new UAParser(userAgent);
    const browser = parser.getBrowser().name;
    const os = parser.getOS().name;
    const device = parser.getDevice().type;

    const lastUsedAt = new Date();

    const userSession = await this.sessionService.createSession({
      user,
      refreshToken,
      ipAddress,
      userAgent,
      browser,
      os,
      device,
      lastUsedAt,
    });

    const session = this.buildSessionPayload(user, userSession.idSession);

    const accessToken = this.jwtService.sign(session, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_SECRET_EXPIRES_IN as number | undefined,
    });

    return {
      accessToken,
      refreshToken,
      userSession,
    };
  }

  decodeToken(token: string): JwtPayload | null {
    const decoded: unknown = this.jwtService.decode(token);
    if (!decoded || typeof decoded == 'string') return null;

    return decoded as JwtPayload;
  }

  private buildSessionPayload(user: User, idSession: number) {
    const roles = user.roles.map((r) => r.name);

    const permissions = [...new Set(user.roles.flatMap((r) => r.permissions.map((p) => p.name)))];

    return {
      idUser: user.idUser,
      idSession,
      name: user.name,
      username: user.username,
      email: user.email,
      roles,
      permissions,
    };
  }

  async getSession(idUser: number, idSession: number) {
    const user = await this.userService.getOneById(idUser);
    if (!user) throw new UnauthorizedException('User not found');

    return this.buildSessionPayload(user, idSession);
  }

  async refreshToken(token: string) {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: process.env.JWT_ACCESS_REFRESH,
      });

      const session = await this.sessionService.validateRefreshToken(token);

      if (session.user.idUser !== payload.idUser)
        throw new UnauthorizedException('Invalid session');

      await this.sessionService.updateLastSessionUsed(session);

      const newPayload = await this.getSession(payload.idUser, session.idSession);

      const newAccessToken = this.jwtService.sign(newPayload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: process.env.JWT_ACCESS_SECRET_EXPIRES_IN as number | undefined,
      });

      await this.sessionService.updateLastSessionUsed(session);

      return { accessToken: newAccessToken };
    } catch (error) {
      throw new Error(`Invalid token refresh: ${(error as Error).message}`);
    }
  }
}
