import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import { CreateAppointmentDto } from 'src/dtos/appointments/create-appointment.dto';
import { AppointmentsQueryDto } from 'src/dtos/appointments/appointments-query.dto';
import { CreateAdministrativeAppointmentDto } from 'src/dtos/appointments/create-administrative-appointment.dto';
import { PatientSelectionQueryDto } from 'src/dtos/appointments/patient-selection-query.dto';
import { AppointmentsService } from 'src/services/appointments/appointments.service';

@ApiBearerAuth('access-token')
@ApiTags('Appointments')
@Permissions('appointment.create')
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Get('mine')
  @Permissions('appointment.get-mine')
  mine(@CurrentUser() user: JwtPayload, @Query() query: AppointmentsQueryDto) {
    return this.service.mine(user.idUser, query);
  }

  @Get('patients')
  @Permissions('appointment.create-for-patient')
  patients(@Query() query: PatientSelectionQueryDto) {
    return this.service.patients(query);
  }

  @Post('for-patient')
  @Permissions('appointment.create-for-patient')
  createForPatient(
    @Body() dto: CreateAdministrativeAppointmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createForPatient(dto, user.idUser);
  }

  @Post()
  create(@Body() dto: CreateAppointmentDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.idUser);
  }
}
