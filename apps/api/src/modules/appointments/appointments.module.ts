import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReschedulingProposal } from 'src/entities/appointments/rescheduling-proposal.entity';
import { Appointment } from 'src/entities/appointments/appointment.entity';
import { AppointmentsController } from 'src/controllers/appointments/appointments.controller';
import { AppointmentsService } from 'src/services/appointments/appointments.service';
import { SchedulesModule } from '../schedules/schedules.module';

@Module({
  imports: [TypeOrmModule.forFeature([Appointment, ReschedulingProposal]), SchedulesModule],
  providers: [AppointmentsService],
  controllers: [AppointmentsController],
})
export class AppointmentsModule {}
