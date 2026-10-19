import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import { CreateAppointmentDto } from 'src/dtos/appointments/create-appointment.dto';
import { AppointmentsQueryDto } from 'src/dtos/appointments/appointments-query.dto';
import { CreateAdministrativeAppointmentDto } from 'src/dtos/appointments/create-administrative-appointment.dto';
import { PatientSelectionQueryDto } from 'src/dtos/appointments/patient-selection-query.dto';
import { DoctorAgendaQueryDto } from 'src/dtos/appointments/doctor-agenda-query.dto';
import { CancelDoctorAppointmentDto } from 'src/dtos/appointments/cancel-doctor-appointment.dto';
import { ReschedulingAvailabilityQueryDto } from 'src/dtos/appointments/rescheduling-availability-query.dto';
import { PaginationQueryDto } from 'src/dtos/common/pagination-query.dto';
import { RespondReschedulingDto } from 'src/dtos/appointments/respond-rescheduling.dto';
import { AppointmentsService } from 'src/services/appointments/appointments.service';

@ApiBearerAuth('access-token')
@ApiTags('Appointments')
@Permissions('appointment.create')
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Patch(':idAppointment/cancel')
  @Permissions('appointment.cancel-mine')
  cancelMine(@Param('idAppointment', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.service.cancelMine(id, user.idUser);
  }

  @Patch(':idAppointment/cancel-as-doctor')
  @Permissions('appointment.cancel-as-doctor')
  cancelAsDoctor(
    @Param('idAppointment', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CancelDoctorAppointmentDto,
  ) {
    return this.service.cancelAsDoctor(id, user.idUser, dto.reason);
  }

  @Post(':idAppointment/rescheduling-proposals')
  @Permissions('appointment.propose-rescheduling')
  proposeRescheduling(
    @Param('idAppointment', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.service.proposeRescheduling(id, user.idUser, dto);
  }

  @Get(':idAppointment/rescheduling-availability')
  @Permissions('appointment.propose-rescheduling')
  reschedulingAvailability(
    @Param('idAppointment', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Query() query: ReschedulingAvailabilityQueryDto,
  ) {
    return this.service.reschedulingAvailability(id, user.idUser, query);
  }

  @Get(':idAppointment/rescheduling-proposals')
  @Permissions('appointment.get-mine')
  patientProposals(
    @Param('idAppointment', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Query() query: PaginationQueryDto,
  ) {
    return this.service.patientProposals(id, user.idUser, query);
  }

  @Patch('rescheduling-proposals/:idProposal/response')
  @Permissions('appointment.respond-rescheduling')
  respondRescheduling(
    @Param('idProposal', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RespondReschedulingDto,
  ) {
    return this.service.respondRescheduling(id, user.idUser, dto.status);
  }

  @Get(':idAppointment/rescheduling-proposals/doctor')
  @Permissions('appointment.get-agenda')
  doctorProposals(
    @Param('idAppointment', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Query() query: PaginationQueryDto,
  ) {
    return this.service.doctorProposals(id, user.idUser, query);
  }

  @Get('agenda')
  @Permissions('appointment.get-agenda')
  agenda(@CurrentUser() user: JwtPayload, @Query() query: DoctorAgendaQueryDto) {
    return this.service.agenda(user.idUser, query);
  }

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
