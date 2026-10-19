import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import { CreateScheduleDto } from 'src/dtos/schedules/create-schedule.dto';
import { PaginationQueryDto } from 'src/dtos/common/pagination-query.dto';
import { AvailabilityQueryDto } from 'src/dtos/schedules/availability-query.dto';
import { UpdateScheduleDto } from 'src/dtos/schedules/update-schedule.dto';
import { SchedulesService } from 'src/services/schedules/schedules.service';

@ApiBearerAuth('access-token')
@ApiTags('Schedules')
@Permissions('schedule.create')
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly service: SchedulesService) {}

  @Get('editing-specialties')
  @Permissions('schedule.update')
  editingSpecialties(@CurrentUser() user: JwtPayload, @Query() query: PaginationQueryDto) {
    return this.service.specialties(user.idUser, query);
  }

  @Get('mine')
  @Permissions('schedule.update')
  mine(@CurrentUser() user: JwtPayload, @Query() query: PaginationQueryDto) {
    return this.service.mine(user.idUser, query);
  }

  @Put(':idSchedule')
  @Permissions('schedule.update')
  update(
    @Param('idSchedule', ParseIntPipe) id: number,
    @Body() dto: UpdateScheduleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user.idUser);
  }

  @Get('availability')
  @Permissions('schedule.get-availability')
  availability(@Query() query: AvailabilityQueryDto) {
    return this.service.availability(query);
  }

  @Get('specialties')
  specialties(@CurrentUser() user: JwtPayload, @Query() query: PaginationQueryDto) {
    return this.service.specialties(user.idUser, query);
  }

  @Post()
  create(@Body() dto: CreateScheduleDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.idUser);
  }
}
