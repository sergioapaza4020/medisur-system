import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Doctor } from 'src/entities/doctors/doctors.entity';
import { DoctorSpecialtyHistory } from 'src/entities/doctors/doctor-specialty-history.entity';
import { DoctorsService } from 'src/services/doctors/doctors.service';
import { DoctorsController } from 'src/controllers/doctors/doctors.controller';
import { UsersModule } from '../users/users.module';
import { RolesModule } from '../roles/roles.module';
import { SpecialtiesModule } from '../specialties/specialties.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Doctor, DoctorSpecialtyHistory]),
    UsersModule,
    RolesModule,
    SpecialtiesModule,
    StorageModule,
  ],
  providers: [DoctorsService],
  controllers: [DoctorsController],
  exports: [DoctorsService],
})
export class DoctorsModule {}
