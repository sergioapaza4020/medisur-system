import { NestFactory } from '@nestjs/core';

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    createApplicationContext: jest.fn().mockResolvedValue({ enableShutdownHooks: jest.fn() }),
    create: jest.fn(),
  },
}));
jest.mock('./modules/worker/worker.module', () => ({ WorkerModule: class WorkerModule {} }));

it('boots an application context, never an HTTP application', async () => {
  jest.requireActual('./worker');
  await Promise.resolve();
  expect(
    Object.getOwnPropertyDescriptor(NestFactory, 'createApplicationContext')?.value as unknown,
  ).toHaveBeenCalledTimes(1);
  expect(
    Object.getOwnPropertyDescriptor(NestFactory, 'create')?.value as unknown,
  ).not.toHaveBeenCalled();
});
