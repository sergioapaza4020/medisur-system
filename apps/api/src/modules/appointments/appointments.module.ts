import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from 'src/entities/appointments/appointment.entity';
import { AppointmentsController } from 'src/controllers/appointments/appointments.controller';
import { AppointmentsService } from 'src/services/appointments/appointments.service';
import { SchedulesModule } from '../schedules/schedules.module';

@Module({
  imports: [TypeOrmModule.forFeature([Appointment]), SchedulesModule],
  providers: [AppointmentsService],
  controllers: [AppointmentsController],
})
export class AppointmentsModule {}
