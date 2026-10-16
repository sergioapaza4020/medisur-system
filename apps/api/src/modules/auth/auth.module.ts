import { Module } from '@nestjs/common';
import { AuthController } from 'src/controllers/auth/auth.controller';
import { AuthService } from 'src/services/auth/auth.service';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from '@core/strategies/jwt/jwt.strategy';
import { ConfigModule } from '@nestjs/config';
import { SessionsModule } from '../sessions/sessions.module';
import { MailModule } from '../mail/mail.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/entities/users/users.entity';
import {
  PasswordRecoveryToken,
  PasswordRecoveryRateLimit,
} from 'src/entities/auth/password-recovery.entity';
import { PasswordRecoveryService } from 'src/services/auth/password-recovery.service';
import { PasswordRecoveryRateLimiter } from 'src/services/auth/password-recovery-rate-limiter';
import { PasswordRecoveryController } from 'src/controllers/auth/password-recovery.controller';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_ACCESS_SECRET,
        signOptions: {
          expiresIn: process.env.JWT_ACCESS_SECRET_EXPIRES_IN as number | undefined,
        },
      }),
    }),
    PassportModule,
    ConfigModule,
    UsersModule,
    SessionsModule,
    MailModule,
    TypeOrmModule.forFeature([User, PasswordRecoveryToken, PasswordRecoveryRateLimit]),
  ],
  providers: [AuthService, JwtStrategy, PasswordRecoveryService, PasswordRecoveryRateLimiter],
  controllers: [AuthController, PasswordRecoveryController],
  exports: [AuthService],
})
export class AuthModule {}
