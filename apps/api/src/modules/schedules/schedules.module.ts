import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Schedule } from 'src/entities/schedules/schedule.entity';
import { SchedulesService } from 'src/services/schedules/schedules.service';
import { SchedulesController } from 'src/controllers/schedules/schedules.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Schedule])],
  providers: [SchedulesService],
  controllers: [SchedulesController],
})
export class SchedulesModule {}
