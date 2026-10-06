import 'dotenv/config';
import 'tsconfig-paths/register';

import { databaseConfig } from '../core/config/database/database.config';
import { DataSource } from 'typeorm';

const AppDataSource = new DataSource({
  ...databaseConfig,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
});

export default AppDataSource;
