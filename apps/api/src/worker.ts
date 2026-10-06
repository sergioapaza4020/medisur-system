import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerModule } from './modules/worker/worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  Logger.log(
    `Worker application context ready pid=${process.pid}; no HTTP listener`,
    'WorkerBootstrap',
  );
}
void bootstrap().catch(() => {
  Logger.error('Worker bootstrap failed; verify environment and infrastructure', 'WorkerBootstrap');
  process.exitCode = 1;
});
