import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionsController } from 'src/controllers/sessions/sessions.controller';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { SessionsService } from 'src/services/sessions/sessions.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserSession])],
  providers: [SessionsService],
  controllers: [SessionsController],
  exports: [SessionsService],
})
export class SessionsModule {}
