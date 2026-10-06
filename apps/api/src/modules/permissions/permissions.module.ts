import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionsController } from 'src/controllers/permissions/permissions.controller';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { PermissionsService } from 'src/services/permissions/permissions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Permission])],
  providers: [PermissionsService],
  controllers: [PermissionsController],
  exports: [PermissionsService],
})
export class PermissionsModule {}
