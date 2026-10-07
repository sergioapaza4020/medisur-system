import AppDataSource from './datasource';
import { seedAccessControl } from './seeders/access-control.seeder';

async function seed() {
  await AppDataSource.initialize();

  console.log('Database connected');

  try {
    await AppDataSource.transaction(seedAccessControl);
  } finally {
    await AppDataSource.destroy();
  }

  console.log('Seed completed');
}

void seed().catch(() => {
  console.error('Seed failed');
  process.exitCode = 1;
});
