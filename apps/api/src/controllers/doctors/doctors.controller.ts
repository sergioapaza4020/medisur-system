import {
  Body,
  Controller,
  Delete,
  Get,
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
import { DoctorCreateDto, DoctorsQueryDto } from 'src/dtos/doctors/doctors.dto';
import { UsersQueryDto } from 'src/dtos/users/users-query.dto';
import { DoctorsService } from 'src/services/doctors/doctors.service';

@ApiBearerAuth('access-token')
@ApiTags('Doctors')
@Controller('doctors')
export class DoctorsController {
  constructor(private readonly service: DoctorsService) {}

  @Get('registration-users')
  @Permissions('doctor.create')
  searchRegistrationUsers(@Query() query: UsersQueryDto) {
    return this.service.searchRegistrationUsers(query);
  }

  @Get()
  @Permissions('doctor.get-all')
  getAll(@Query() query: DoctorsQueryDto) {
    return this.service.getAll(query);
  }

  @Post()
  @Permissions('doctor.create')
  create(@Body() dto: DoctorCreateDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.idUser);
  }

  @Delete(':idDoctor')
  @Permissions('doctor.delete')
  deactivate(@Param('idDoctor', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.service.changeStatus(id, false, user.idUser);
  }

  @Patch('reactivate/:idDoctor')
  @Permissions('doctor.reactivate')
  reactivate(@Param('idDoctor', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.service.changeStatus(id, true, user.idUser);
  }
}
