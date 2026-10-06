import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { databaseConfig } from '@core/config/database/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: join(__dirname, '../../../.env') }),
    TypeOrmModule.forRoot({
      ...databaseConfig,
      entities: [join(__dirname, '../../entities/**/*.entity{.ts,.js}')],
    }),
  ],
  providers: [],
})
export class WorkerModule {}
