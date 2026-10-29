import { Controller, Get, Header, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import { PaginationQueryDto } from 'src/dtos/common/pagination-query.dto';
import { MedicalRecordsService } from 'src/services/medical-records/medical-records.service';

@ApiBearerAuth('access-token')
@ApiTags('Medical records')
@Permissions('medical-record.get-by-appointment')
@Controller('medical-records')
export class MedicalRecordsController {
  constructor(private readonly service: MedicalRecordsService) {}

  @Get('by-extraordinary-grant/:idGrant')
  @Permissions('medical-record.get-extraordinary')
  @Header('Cache-Control', 'no-store')
  byExtraordinaryGrant(
    @Param('idGrant', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Query() query: PaginationQueryDto,
  ) {
    return this.service.byExtraordinaryGrant(id, user.idUser, query);
  }

  @Get('mine')
  @Permissions('medical-record.get-mine')
  @Header('Cache-Control', 'no-store')
  mine(@CurrentUser() user: JwtPayload, @Query() query: PaginationQueryDto) {
    return this.service.mine(user.idUser, query);
  }

  @Get('by-appointment/:idAppointment')
  @Header('Cache-Control', 'no-store')
  byAppointment(
    @Param('idAppointment', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Query() query: PaginationQueryDto,
  ) {
    return this.service.byAppointment(id, user.idUser, query);
  }
}
