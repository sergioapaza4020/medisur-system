import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Doctor } from 'src/entities/doctors/doctors.entity';
import { DoctorsService } from 'src/services/doctors/doctors.service';
import { DoctorsController } from 'src/controllers/doctors/doctors.controller';
import { UsersModule } from '../users/users.module';
import { RolesModule } from '../roles/roles.module';
import { SpecialtiesModule } from '../specialties/specialties.module';

@Module({
  imports: [TypeOrmModule.forFeature([Doctor]), UsersModule, RolesModule, SpecialtiesModule],
  providers: [DoctorsService],
  controllers: [DoctorsController],
  exports: [DoctorsService],
})
export class DoctorsModule {}
