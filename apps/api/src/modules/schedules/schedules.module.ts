import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleHistory } from 'src/entities/schedules/schedule-history.entity';
import { Schedule } from 'src/entities/schedules/schedule.entity';
import { SchedulesService } from 'src/services/schedules/schedules.service';
import { SchedulesController } from 'src/controllers/schedules/schedules.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Schedule, ScheduleHistory])],
  providers: [SchedulesService],
  exports: [SchedulesService],
  controllers: [SchedulesController],
})
export class SchedulesModule {}
