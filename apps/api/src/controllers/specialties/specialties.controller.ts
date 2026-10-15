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
import { SpecialtiesQueryDto, SpecialtyWriteDto } from 'src/dtos/specialties/specialties.dto';
import { SpecialtiesService } from 'src/services/specialties/specialties.service';
import { Public } from '@core/decorators/public/public.decorator';
import { PaginationQueryDto } from 'src/dtos/common/pagination-query.dto';

@ApiBearerAuth('access-token')
@ApiTags('Specialties')
@Controller('specialties')
export class SpecialtiesController {
  constructor(private readonly service: SpecialtiesService) {}

  @Public()
  @Get('public')
  getPublicPage(@Query() query: PaginationQueryDto) {
    return this.service.getPublicPage(query);
  }

  @Get()
  @Permissions('specialty.get-all')
  getAll(@Query() query: SpecialtiesQueryDto) {
    return this.service.getAll(query);
  }

  @Get('id/:idSpecialty')
  @Permissions('specialty.get-one-by-id')
  getOneById(@Param('idSpecialty', ParseIntPipe) id: number) {
    return this.service.getOneById(id);
  }

  @Post()
  @Permissions('specialty.create')
  create(@Body() dto: SpecialtyWriteDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.idUser);
  }

  @Patch('reactivate/:idSpecialty')
  @Permissions('specialty.reactivate')
  reactivate(@Param('idSpecialty', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.service.reactivate(id, user.idUser);
  }

  @Patch(':idSpecialty')
  @Permissions('specialty.update')
  update(
    @Param('idSpecialty', ParseIntPipe) id: number,
    @Body() dto: SpecialtyWriteDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user.idUser);
  }

  @Delete(':idSpecialty')
  @Permissions('specialty.delete')
  deactivate(@Param('idSpecialty', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.service.deactivate(id, user.idUser);
  }
}
