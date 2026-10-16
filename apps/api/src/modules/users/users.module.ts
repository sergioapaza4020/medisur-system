import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from 'src/controllers/users/users.controller';
import { User } from 'src/entities/users/users.entity';
import { UsersService } from 'src/services/users/users.service';
import { RolesModule } from '../roles/roles.module';
import { SessionsModule } from '../sessions/sessions.module';
import { MyAccountController } from 'src/controllers/users/my-account.controller';
import { MyAccountService } from 'src/services/users/my-account.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), RolesModule, SessionsModule, StorageModule],
  providers: [UsersService, MyAccountService],
  controllers: [MyAccountController, UsersController],
  exports: [UsersService],
})
export class UsersModule {}
