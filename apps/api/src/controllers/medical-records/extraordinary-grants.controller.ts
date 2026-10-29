import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import { PaginationQueryDto } from 'src/dtos/common/pagination-query.dto';
import { PatientSelectionQueryDto } from 'src/dtos/appointments/patient-selection-query.dto';
import { DoctorsQueryDto } from 'src/dtos/doctors/doctors.dto';
import { RecordStatus } from 'src/dtos/common/status-query.dto';
import {
  CreateExtraordinaryGrantDto,
  RevokeExtraordinaryGrantDto,
} from 'src/dtos/medical-records/extraordinary-grant.dto';
import { ExtraordinaryGrantsService } from 'src/services/medical-records/extraordinary-grants.service';
import { AppointmentsService } from 'src/services/appointments/appointments.service';
import { DoctorsService } from 'src/services/doctors/doctors.service';

@ApiBearerAuth('access-token')
@ApiTags('Extraordinary clinical access')
@Permissions('medical-record.manage-extraordinary')
@Controller('medical-records/extraordinary-access')
export class ExtraordinaryGrantsController {
  constructor(
    private readonly service: ExtraordinaryGrantsService,
    private readonly appointments: AppointmentsService,
    private readonly doctors: DoctorsService,
  ) {}
  @Post() create(@Body() dto: CreateExtraordinaryGrantDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.idUser);
  }
  @Patch(':id/revoke') revoke(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RevokeExtraordinaryGrantDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.revoke(id, user.idUser, dto.reason);
  }
  @Get() @Header('Cache-Control', 'no-store') list(@Query() query: PaginationQueryDto) {
    return this.service.list(query);
  }
  @Get('mine')
  @Permissions('medical-record.get-extraordinary')
  @Header('Cache-Control', 'no-store')
  mine(@Query() query: PaginationQueryDto, @CurrentUser() user: JwtPayload) {
    return this.service.list(query, user.idUser);
  }
  @Get('patients') @Header('Cache-Control', 'no-store') patients(
    @Query() query: PatientSelectionQueryDto,
  ) {
    return this.appointments.patients(query);
  }
  @Get('beneficiaries') @Header('Cache-Control', 'no-store') async beneficiaries(
    @Query() query: PatientSelectionQueryDto,
  ) {
    const result = await this.doctors.getAll(
      Object.assign(new DoctorsQueryDto(), query, { status: RecordStatus.ACTIVE }),
    );
    return {
      ...result,
      data: result.data.map(({ user }) => ({
        idUser: user.idUser,
        name: user.name,
        lastname: user.lastname,
        ci: user.ci,
      })),
    };
  }
}
