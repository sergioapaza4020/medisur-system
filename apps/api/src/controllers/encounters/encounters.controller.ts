import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import { CreateEncounterDto } from 'src/dtos/encounters/create-encounter.dto';
import { EncountersService } from 'src/services/encounters/encounters.service';

@ApiBearerAuth('access-token')
@ApiTags('Encounters')
@Permissions('encounter.create')
@Controller('encounters')
export class EncountersController {
  constructor(private readonly service: EncountersService) {}

  @Post()
  create(@Body() dto: CreateEncounterDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.idUser);
  }
}
