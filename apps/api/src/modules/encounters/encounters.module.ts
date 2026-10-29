import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Encounter } from 'src/entities/encounters/encounter.entity';
import { MedicalRecord } from 'src/entities/medical-records/medical-record.entity';
import { EncountersService } from 'src/services/encounters/encounters.service';
import { EncountersController } from 'src/controllers/encounters/encounters.controller';
import { SchedulesModule } from '../schedules/schedules.module';

@Module({
  imports: [TypeOrmModule.forFeature([Encounter, MedicalRecord]), SchedulesModule],
  providers: [EncountersService],
  controllers: [EncountersController],
})
export class EncountersModule {}
