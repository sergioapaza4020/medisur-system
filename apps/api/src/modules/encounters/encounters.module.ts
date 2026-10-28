import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Encounter } from 'src/entities/encounters/encounter.entity';
import { EncountersService } from 'src/services/encounters/encounters.service';
import { EncountersController } from 'src/controllers/encounters/encounters.controller';
import { SchedulesModule } from '../schedules/schedules.module';

@Module({
  imports: [TypeOrmModule.forFeature([Encounter]), SchedulesModule],
  providers: [EncountersService],
  controllers: [EncountersController],
})
export class EncountersModule {}
