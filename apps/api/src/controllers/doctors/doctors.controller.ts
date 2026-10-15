import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import {
  DoctorCreateDto,
  DoctorsQueryDto,
  DoctorSpecialtiesDto,
} from 'src/dtos/doctors/doctors.dto';
import { UsersQueryDto } from 'src/dtos/users/users-query.dto';
import { DoctorsService } from 'src/services/doctors/doctors.service';
import { PaginationQueryDto } from 'src/dtos/common/pagination-query.dto';
import { Public } from '@core/decorators/public/public.decorator';

@ApiBearerAuth('access-token')
@ApiTags('Doctors')
@Controller('doctors')
export class DoctorsController {
  constructor(private readonly service: DoctorsService) {}

  @Public()
  @Get('public')
  getPublicPage(@Query() query: PaginationQueryDto) {
    return this.service.getPublicPage(query);
  }

  @Get('selection-specialties')
  @Permissions('doctor.get-by-specialty')
  getSelectionSpecialties(@Query() query: PaginationQueryDto) {
    return this.service.getSelectionSpecialties(query);
  }

  @Get('by-specialty/:idSpecialty')
  @Permissions('doctor.get-by-specialty')
  getBySpecialty(
    @Param('idSpecialty', ParseIntPipe) id: number,
    @Query() query: PaginationQueryDto,
  ) {
    if (id < 1) throw new BadRequestException('Especialidad activa no encontrada');
    return this.service.getBySpecialty(id, query);
  }

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

  @Get(':idDoctor/specialties')
  @Permissions('doctor.assign-specialties')
  getSpecialties(@Param('idDoctor', ParseIntPipe) id: number) {
    return this.service.getSpecialties(id);
  }

  @Put(':idDoctor/specialties')
  @Permissions('doctor.assign-specialties')
  assignSpecialties(
    @Param('idDoctor', ParseIntPipe) id: number,
    @Body() dto: DoctorSpecialtiesDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.assignSpecialties(id, dto, user.idUser);
  }

  @Patch('reactivate/:idDoctor')
  @Permissions('doctor.reactivate')
  reactivate(@Param('idDoctor', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.service.changeStatus(id, true, user.idUser);
  }
}
