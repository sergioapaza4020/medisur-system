import AppDataSource from './datasource';

async function seed() {
  await AppDataSource.initialize();

  console.log('Database connected');

  await AppDataSource.destroy();

  console.log('Seed completed');
}

void seed();
