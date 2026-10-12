import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Specialty } from 'src/entities/specialties/specialties.entity';
import { SpecialtiesService } from 'src/services/specialties/specialties.service';
import { SpecialtiesController } from 'src/controllers/specialties/specialties.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Specialty])],
  providers: [SpecialtiesService],
  controllers: [SpecialtiesController],
  exports: [SpecialtiesService],
})
export class SpecialtiesModule {}
