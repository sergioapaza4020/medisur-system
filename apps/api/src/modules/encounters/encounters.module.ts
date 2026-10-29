import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Encounter } from 'src/entities/encounters/encounter.entity';
import { MedicalRecord } from 'src/entities/medical-records/medical-record.entity';
import { MedicalRecordAccess } from 'src/entities/medical-records/medical-record-access.entity';
import { MedicalRecordsService } from 'src/services/medical-records/medical-records.service';
import { MedicalRecordsController } from 'src/controllers/medical-records/medical-records.controller';
import { EncountersService } from 'src/services/encounters/encounters.service';
import { EncountersController } from 'src/controllers/encounters/encounters.controller';
import { SchedulesModule } from '../schedules/schedules.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Encounter, MedicalRecord, MedicalRecordAccess]),
    SchedulesModule,
  ],
  providers: [EncountersService, MedicalRecordsService],
  controllers: [EncountersController, MedicalRecordsController],
})
export class EncountersModule {}
